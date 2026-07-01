/**
 * NORTH PINE カレンダー（GitHub Pages / gviz CSV）
 */
(function () {
  "use strict";

  const SPREADSHEET_ID = "1-07mnQUToyJjD2pNau99a0dCLmg_0chswzvv3eW4t30";
  const RECORD_SHEET_NAME = "record";

  function getGasWebAppUrl() {
    const meta = document.querySelector('meta[name="gas-web-app-url"]');
    const url = meta ? String(meta.getAttribute("content") || "").trim() : "";
    return url;
  }

  function gasCalendarApiUrl() {
    const base = getGasWebAppUrl();
    if (!base) return "";
    const sep = base.indexOf("?") >= 0 ? "&" : "?";
    return base + sep + "api=1";
  }

  function formatUserError(err) {
    const msg =
      err && err.message ? String(err.message) : err ? String(err) : "エラーが発生しました。";
    if (/^load failed$/i.test(msg) || /failed to fetch/i.test(msg)) {
      if (typeof location !== "undefined" && location.protocol === "file:") {
        return (
          "データの取得に失敗しました。index.html を直接開かず、" +
          "ローカルサーバー（例: npx serve）または GitHub Pages で開いてください。"
        );
      }
      return (
        "データの取得に失敗しました。ネットワーク接続と GAS ウェブアプリの URL を確認してください。"
      );
    }
    return msg;
  }
  const MAX_PARTICIPANTS = 15;
  const MAX_TEAM_SLOTS = 3;
  /** record シート: H列（0-based index 7）以降が練習試合チームのメンバー名 */
  const TEAM_MEMBER_COL_START = 7;
  const TEAM_SLOT_LABELS = ["チームA", "チームB", "チームC"];
  const BUNDLE_CACHE_TTL_MS = 10 * 60 * 1000;
  const BUNDLE_IDB_NAME = "north-pine-viewer";
  const BUNDLE_IDB_STORE = "gasBundle";

  const FIRST_TIME_MARKERS = [
    "【初参加】",
    "（初）",
    "(初)",
    "【初】",
    "初参加",
    "［初］",
    "[初]",
  ];

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const EVENT_TIME_SLOT = "19:15～21:45";
  const EVENT_TIME_START = "19:15";
  const EVENT_TIME_END_LINE = "～21:45";

  const STATE = {
    schedules: [],
    range: null,
    groupByKey: {},
    currentSessionKey: null,
  };

  // --- CSV / fetch ---

  function csvUrl(sheetName) {
    const q = new URLSearchParams({ tqx: "out:csv", sheet: sheetName });
    return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${q}`;
  }

  function csvLooksValid(text) {
    const t = String(text || "")
      .replace(/^\uFEFF/, "")
      .trimStart();
    if (!t || t.startsWith("<") || t.startsWith("<!")) return false;
    if (t.length < 2) return false;
    return t.includes(",") || t.includes("\t");
  }

  async function fetchSheetText(sheetName) {
    const url = csvUrl(sheetName);
    let res;
    try {
      res = await fetch(url);
    } catch (fetchErr) {
      throw new Error(formatUserError(fetchErr));
    }
    if (!res.ok) return null;
    const text = await res.text();
    if (!csvLooksValid(text)) return null;
    return text;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let i = 0;
    let inQuotes = false;

    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        cell += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        row.push(cell);
        cell = "";
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
        continue;
      }
      cell += c;
      i++;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
    return rows;
  }

  // --- IndexedDB cache ---

  function bundleRecordCacheKey() {
    const d = new Date();
    const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return `calendar_record_${SPREADSHEET_ID}_v1_${day}`;
  }

  function openBundleIdb_() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(BUNDLE_IDB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(BUNDLE_IDB_STORE)) {
          req.result.createObjectStore(BUNDLE_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function readBundleCache(cacheKey) {
    try {
      const db = await openBundleIdb_();
      const row = await new Promise((resolve) => {
        const tx = db.transaction(BUNDLE_IDB_STORE, "readonly");
        const g = tx.objectStore(BUNDLE_IDB_STORE).get(cacheKey);
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => resolve(null);
      });
      db.close();
      if (!row || typeof row.ts !== "number" || !row.payload) return null;
      if (Date.now() - row.ts > BUNDLE_CACHE_TTL_MS) return null;
      return row.payload;
    } catch (_) {
      return null;
    }
  }

  async function writeBundleCache(cacheKey, payload) {
    try {
      const db = await openBundleIdb_();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(BUNDLE_IDB_STORE, "readwrite");
        tx.objectStore(BUNDLE_IDB_STORE).put({ ts: Date.now(), payload }, cacheKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) {
      /* ignore */
    }
  }

  async function clearBundleCache() {
    try {
      const db = await openBundleIdb_();
      await new Promise((resolve) => {
        const tx = db.transaction(BUNDLE_IDB_STORE, "readwrite");
        tx.objectStore(BUNDLE_IDB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
    } catch (_) {
      /* ignore */
    }
  }

  // --- record パース（calendar.gs.js 相当） ---

  function normalizeKeyPart(s) {
    return String(s || "")
      .replace(/\([^)]*\)/g, "")
      .replace(/（[^）]*）/g, "")
      .replace(/\s+/g, "")
      .trim();
  }

  function sessionStorageKey(dateLabel, place) {
    return normalizeKeyPart(dateLabel) + "\t" + normalizeKeyPart(place);
  }

  function normalizeParticipantDisplay(s) {
    let t = String(s == null ? "" : s);
    t = t.replace(/\u200b|\u200c|\u200d|\ufeff/g, "");
    t = t.replace(/\u00a0|\u3000/g, " ");
    t = t.replace(/\s+/g, " ").trim();
    return t;
  }

  function parseCheckboxCell(v) {
    const t = String(v == null ? "" : v)
      .trim()
      .toUpperCase();
    return (
      t === "TRUE" ||
      t === "1" ||
      t === "YES" ||
      t === "はい" ||
      t === "✓" ||
      t === "☑"
    );
  }

  function parseParticipantCell(raw) {
    const rawStr = normalizeParticipantDisplay(raw);
    if (!rawStr) {
      return { display: "", isFirst: false, isFemale: false };
    }
    let t = rawStr;
    let isFirst = false;
    for (let m = 0; m < FIRST_TIME_MARKERS.length; m++) {
      const mk = FIRST_TIME_MARKERS[m];
      if (t.indexOf(mk) !== -1) {
        isFirst = true;
        t = t.split(mk).join("");
      }
    }
    if (/\bNEW\b/i.test(t)) {
      isFirst = true;
      t = t.replace(/\bNEW\b/gi, "");
    }
    t = t.replace(/\s{2,}/g, " ").trim();
    return {
      display: normalizeParticipantDisplay(t) || rawStr,
      isFirst: isFirst,
      isFemale: false,
    };
  }

  function looksLikeRecordSheetRows(rows) {
    if (!rows || rows.length < 2) return false;
    const r0 = rows[0];
    const a0 = String(r0[0] ?? "").trim();
    const b0 = String(r0[1] ?? "").trim();
    if (b0.includes("日付")) return true;
    if (a0 === "連番" || a0.includes("連番")) return true;
    return false;
  }

  function readRecordRowsFromCsv(rows) {
    const start = looksLikeRecordSheetRows(rows) ? 1 : 0;
    return rows.slice(start);
  }

  function buildSessionGroupsFromRows(rows) {
    const groups = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dateRaw = String(row[1] || "").trim();
      if (!dateRaw) continue;
      const placeRaw = String(row[2] || "").trim() || "—";
      const key = sessionStorageKey(dateRaw, placeRaw);

      if (!groups[key]) {
        groups[key] = {
          dateRaw: dateRaw,
          dateLabel: dateRaw,
          place: placeRaw,
          sessionKey: key,
          bySeq: {},
        };
      }

      const seq = parseInt(String(row[0] || "").trim(), 10);
      const slotIndex =
        Number.isFinite(seq) && seq >= 1 && seq <= MAX_PARTICIPANTS ? seq - 1 : null;
      if (slotIndex === null) continue;

      const parsed = parseParticipantCell(row[3]);
      const fromCb = {
        isFirst: parseCheckboxCell(row[4]),
        isFemale: parseCheckboxCell(row[5]),
        isUnconfirmed: parseCheckboxCell(row[6]),
      };

      groups[key].bySeq[slotIndex] = {
        seq: slotIndex + 1,
        display: parsed.display,
        isFirst: Boolean(parsed.isFirst || fromCb.isFirst),
        isFemale: Boolean(parsed.isFemale || fromCb.isFemale),
        isUnconfirmed: Boolean(fromCb.isUnconfirmed),
        members: parseTeamMembersFromRow(row),
      };
    }

    return groups;
  }

  function parseTeamMembersFromRow(row) {
    const members = [];
    for (let col = TEAM_MEMBER_COL_START; col < row.length; col++) {
      const parsed = parseParticipantCell(row[col]);
      if (!parsed.display) continue;
      members.push({
        seq: members.length + 1,
        display: parsed.display,
        isFirst: Boolean(parsed.isFirst),
        isFemale: false,
        isUnconfirmed: false,
      });
    }
    return members;
  }

  function groupsToSlotsArray(bySeq) {
    const slots = [];
    for (let i = 0; i < MAX_PARTICIPANTS; i++) {
      if (bySeq[i]) {
        slots.push(bySeq[i]);
      } else {
        slots.push({
          seq: i + 1,
          display: "",
          isFirst: false,
          isFemale: false,
          isUnconfirmed: false,
          members: [],
        });
      }
    }
    return slots;
  }

  function countFilledSlots(slots) {
    let n = 0;
    for (let i = 0; i < (slots || []).length; i++) {
      if (normalizeParticipantDisplay(slots[i].display)) n++;
    }
    return n;
  }

  function detectSessionType(bySeq) {
    for (let i = 3; i < MAX_PARTICIPANTS; i++) {
      if (bySeq[i]) return "individual";
    }
    return "team";
  }

  function getTeamMaxSlots(bySeq) {
    let max = 0;
    for (let i = 0; i < MAX_TEAM_SLOTS; i++) {
      if (bySeq[i]) max = i + 1;
    }
    return max || 1;
  }

  function countFilledSlotsForSession(slots, sessionType, maxSlots) {
    const limit =
      sessionType === "team"
        ? maxSlots || MAX_TEAM_SLOTS
        : MAX_PARTICIPANTS;
    let n = 0;
    for (let i = 0; i < limit; i++) {
      if (slots[i] && normalizeParticipantDisplay(slots[i].display)) n++;
    }
    return n;
  }

  function sessionSummaryFromEnriched(enriched) {
    return {
      sessionKey: enriched.sessionKey,
      dateLabel: enriched.dateLabel,
      place: enriched.place,
      year: enriched.year,
      month: enriched.month,
      day: enriched.day,
      dateIso: enriched.dateIso,
      filledCount: enriched.filledCount,
      maxSlots: enriched.maxSlots,
      sessionType: enriched.sessionType,
      hasFirst: enriched.hasFirst,
      hasUnconfirmed: enriched.hasUnconfirmed,
    };
  }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function formatDateIso(d) {
    const y = d.getFullYear();
    const m = ("0" + (d.getMonth() + 1)).slice(-2);
    const day = ("0" + d.getDate()).slice(-2);
    return y + "-" + m + "-" + day;
  }

  const NEXT_MONTH_RELEASE_DAY = 23;

  function getTodayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function shouldShowNextMonth() {
    return getTodayLocal().getDate() >= NEXT_MONTH_RELEASE_DAY;
  }

  function getTwoMonthRange() {
    const today = getTodayLocal();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = shouldShowNextMonth()
      ? new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: start, end: end };
  }

  function parseRecordDate(dateValue) {
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return stripTime(dateValue);
    }
    const label = String(dateValue == null ? "" : dateValue).trim();
    if (!label) return null;

    const full = label.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})/);
    if (full) {
      return stripTime(
        new Date(parseInt(full[1], 10), parseInt(full[2], 10) - 1, parseInt(full[3], 10)),
      );
    }

    const t = label
      .replace(/\([^)]*\)/g, "")
      .replace(/（[^）]*）/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const jp = t.match(/(\d{1,2})月(\d{1,2})日/);
    if (jp) {
      const y = getTodayLocal().getFullYear();
      return stripTime(new Date(y, parseInt(jp[1], 10) - 1, parseInt(jp[2], 10)));
    }

    const md = t.match(/(\d{1,2})[\/．\.](\d{1,2})/);
    if (md) {
      const yy = getTodayLocal().getFullYear();
      return stripTime(new Date(yy, parseInt(md[1], 10) - 1, parseInt(md[2], 10)));
    }

    return null;
  }

  function parseRecordDateInRange(dateValue, rangeStart, rangeEnd) {
    const label = String(dateValue == null ? "" : dateValue).trim();
    if (!label) return null;

    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      const d = stripTime(dateValue);
      if (d >= stripTime(rangeStart) && d <= rangeEnd) return d;
      return null;
    }

    const yStart = rangeStart.getFullYear();
    const yEnd = rangeEnd.getFullYear();

    const t = label
      .replace(/\([^)]*\)/g, "")
      .replace(/（[^）]*）/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const full = label.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})/);
    if (full) {
      const dtFull = stripTime(
        new Date(parseInt(full[1], 10), parseInt(full[2], 10) - 1, parseInt(full[3], 10)),
      );
      if (dtFull >= stripTime(rangeStart) && dtFull <= rangeEnd) return dtFull;
      return null;
    }

    const jp = t.match(/(\d{1,2})月(\d{1,2})日/);
    const md = t.match(/(\d{1,2})[\/．\.](\d{1,2})/);
    if (!jp && !md) return null;

    let month;
    let day;
    if (jp) {
      month = parseInt(jp[1], 10);
      day = parseInt(jp[2], 10);
    } else {
      month = parseInt(md[1], 10);
      day = parseInt(md[2], 10);
    }

    for (let y = yStart; y <= yEnd; y++) {
      const d = new Date(y, month - 1, day);
      if (d >= stripTime(rangeStart) && d <= rangeEnd) return d;
    }
    return null;
  }

  function enrichSessionGroup(group, eventDate) {
    const sessionType = detectSessionType(group.bySeq);
    const slots = groupsToSlotsArray(group.bySeq);
    const maxSlots =
      sessionType === "team" ? getTeamMaxSlots(group.bySeq) : MAX_PARTICIPANTS;
    const filledCount = countFilledSlotsForSession(slots, sessionType, maxSlots);
    let hasFirst = false;
    let hasUnconfirmed = false;

    for (let j = 0; j < slots.length; j++) {
      if (slots[j].display) {
        if (slots[j].isFirst) hasFirst = true;
        if (slots[j].isUnconfirmed) hasUnconfirmed = true;
      }
    }

    return {
      sessionKey: group.sessionKey,
      dateLabel: group.dateLabel,
      place: group.place,
      year: eventDate.getFullYear(),
      month: eventDate.getMonth() + 1,
      day: eventDate.getDate(),
      dateIso: formatDateIso(eventDate),
      filledCount: filledCount,
      maxSlots: maxSlots,
      sessionType: sessionType,
      hasFirst: hasFirst,
      hasUnconfirmed: hasUnconfirmed,
      slots: slots,
    };
  }

  function loadSessionsInRange(groups, rangeStart, rangeEnd) {
    const out = [];

    for (const key of Object.keys(groups)) {
      const group = groups[key];
      const eventDate = parseRecordDateInRange(group.dateRaw, rangeStart, rangeEnd);
      if (!eventDate) continue;
      const enriched = enrichSessionGroup(group, eventDate);
      STATE.groupByKey[key] = enriched;
      out.push(sessionSummaryFromEnriched(enriched));
    }

    out.sort((a, b) => {
      if (a.dateIso !== b.dateIso) return a.dateIso < b.dateIso ? -1 : 1;
      return String(a.place || "").localeCompare(String(b.place || ""), "ja");
    });

    return out;
  }

  function getSessionDetail(sessionKey) {
    sessionKey = String(sessionKey || "").trim();
    if (!sessionKey) {
      throw new Error("日程キーが指定されていません。");
    }
    const group = STATE.groupByKey[sessionKey];
    if (!group) {
      throw new Error("日程が見つかりません。");
    }
    return {
      session: {
        dateLabel: group.dateLabel,
        place: group.place,
        filledCount: group.filledCount,
        maxSlots: group.maxSlots,
        sessionType: group.sessionType,
        sessionKey: group.sessionKey,
      },
      slots: group.slots,
    };
  }

  async function fetchRecordRows(skipCache) {
    const cacheKey = bundleRecordCacheKey();
    if (!skipCache) {
      const cached = await readBundleCache(cacheKey);
      if (cached && Array.isArray(cached.rows)) {
        return cached.rows;
      }
    }

    const text = await fetchSheetText(RECORD_SHEET_NAME);
    if (!text) {
      throw new Error(
        "record シートの取得に失敗しました。スプレッドシートが「リンクを知っている全員が閲覧可」になっているか確認してください。",
      );
    }

    const rows = parseCSV(text);
    const dataRows = readRecordRowsFromCsv(rows);
    await writeBundleCache(cacheKey, { rows: dataRows });
    return dataRows;
  }

  function applyGasCalendarPayload(data) {
    STATE.groupByKey = {};
    const groups = data.groupByKey && typeof data.groupByKey === "object" ? data.groupByKey : {};
    for (const key of Object.keys(groups)) {
      STATE.groupByKey[key] = normalizeEnrichedGroup(groups[key], key);
    }
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return {
      range: data.range,
      sessions: sessions.map(function (session) {
        const group = STATE.groupByKey[session.sessionKey];
        if (!group) return session;
        return Object.assign({}, session, {
          sessionType: group.sessionType,
          maxSlots: group.maxSlots,
          filledCount: group.filledCount,
        });
      }),
    };
  }

  function normalizeEnrichedGroup(group, sessionKey) {
    if (!group || typeof group !== "object") return group;
    const slots = (Array.isArray(group.slots) ? group.slots : []).map(function (slot) {
      return Object.assign(
        {
          members: [],
        },
        slot,
        {
          members: Array.isArray(slot.members) ? slot.members : [],
        },
      );
    });
    const sessionType = group.sessionType === "team" ? "team" : "individual";
    const maxSlots =
      group.maxSlots ||
      (sessionType === "team" ? MAX_TEAM_SLOTS : MAX_PARTICIPANTS);
    const filledCount =
      group.filledCount != null
        ? group.filledCount
        : countFilledSlotsForSession(slots, sessionType, maxSlots);
    return Object.assign({}, group, {
      sessionKey: group.sessionKey || sessionKey,
      sessionType: sessionType,
      maxSlots: maxSlots,
      filledCount: filledCount,
      slots: slots,
    });
  }

  function mergeTeamMembersIntoSlots(slots, bySeq) {
    if (!Array.isArray(slots) || !bySeq) return;
    for (let i = 0; i < slots.length; i++) {
      if (bySeq[i] && Array.isArray(bySeq[i].members)) {
        slots[i].members = bySeq[i].members;
      }
    }
  }

  async function repairGasPayloadMetadata(data) {
    if (!data || !data.groupByKey) return data;

    const needsRepair = Object.keys(data.groupByKey).some(function (key) {
      return !data.groupByKey[key].sessionType;
    });
    const needsMembers = Object.keys(data.groupByKey).some(function (key) {
      const slots = data.groupByKey[key].slots;
      if (!Array.isArray(slots) || slots.length === 0) return false;
      return slots.some(function (slot) {
        return !Array.isArray(slot.members);
      });
    });
    if (!needsRepair && !needsMembers) return data;

    try {
      const rows = await fetchRecordRows(true);
      const built = buildSessionGroupsFromRows(rows);
      Object.keys(data.groupByKey).forEach(function (key) {
        const source = built[key];
        if (!source) return;
        const group = data.groupByKey[key];
        mergeTeamMembersIntoSlots(group.slots, source.bySeq);
        if (!group.sessionType) {
          const sessionType = detectSessionType(source.bySeq);
          group.sessionType = sessionType;
          group.maxSlots =
            sessionType === "team"
              ? getTeamMaxSlots(source.bySeq)
              : MAX_PARTICIPANTS;
          group.filledCount = countFilledSlotsForSession(
            group.slots || [],
            sessionType,
            group.maxSlots,
          );
        }
      });
      if (Array.isArray(data.sessions)) {
        data.sessions.forEach(function (session) {
          const group = data.groupByKey[session.sessionKey];
          if (!group) return;
          session.sessionType = group.sessionType;
          session.maxSlots = group.maxSlots;
          session.filledCount = group.filledCount;
        });
      }
    } catch (_) {
      // record CSV が取れない場合は slots ベースの normalize に任せる
    }
    return data;
  }

  async function loadCalendarDataFromGas(skipCache) {
    const apiUrl = gasCalendarApiUrl();
    if (!apiUrl) {
      throw new Error("GAS ウェブアプリ URL が設定されていません。");
    }

    const cacheKey = bundleRecordCacheKey() + "_gas_v2";
    if (!skipCache) {
      const cached = await readBundleCache(cacheKey);
      if (cached && cached.ok && cached.range && Array.isArray(cached.sessions)) {
        return applyGasCalendarPayload(cached);
      }
    }

    let res;
    try {
      res = await fetch(apiUrl);
    } catch (fetchErr) {
      throw new Error(formatUserError(fetchErr));
    }
    if (!res.ok) {
      throw new Error(
        "カレンダーデータの取得に失敗しました（HTTP " + res.status + "）。GAS のデプロイを確認してください。",
      );
    }
    const data = await res.json();
    if (!data || data.ok !== true) {
      throw new Error(
        (data && data.error) ||
          "カレンダーデータの取得に失敗しました。GAS を再デプロイしてください。",
      );
    }

    const repaired = await repairGasPayloadMetadata(data);
    await writeBundleCache(cacheKey, repaired);
    return applyGasCalendarPayload(repaired);
  }

  async function loadCalendarData(skipCache) {
    if (getGasWebAppUrl()) {
      return loadCalendarDataFromGas(skipCache);
    }

    STATE.groupByKey = {};
    const range = getTwoMonthRange();
    const rows = await fetchRecordRows(skipCache);
    const groups = buildSessionGroupsFromRows(rows);
    const sessions = loadSessionsInRange(groups, range.start, range.end);

    return {
      range: {
        startYear: range.start.getFullYear(),
        startMonth: range.start.getMonth() + 1,
        endYear: range.end.getFullYear(),
        endMonth: range.end.getMonth() + 1,
      },
      sessions: sessions,
    };
  }

  // --- UI ---

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatYearMonth(y, m) {
    const year = Number(y);
    const month = Number(m);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return "—";
    return year + "年" + month + "月";
  }

  function setStatus(kind, message) {
    const el = $("status");
    if (!el) return;
    if (!kind) {
      el.className = "status";
      el.textContent = "";
      return;
    }
    el.className = "status is-visible status--" + kind;
    el.textContent = message;
  }

  function chipLineHtml(value, extraClass) {
    const cls = "chip-line" + (extraClass ? " " + extraClass : "");
    return '<span class="' + cls + '">' + escapeHtml(value) + "</span>";
  }

  function normalizePlaceName(place) {
    const p = String(place || "").trim();
    if (!p || p === "—") return "—";
    return p.replace(/^@+/, "").trim() || "—";
  }

  function chipPinSvgHtml() {
    return (
      '<span class="chip-pin" aria-hidden="true">' +
      '<svg class="chip-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
      '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/>' +
      '<circle cx="12" cy="10" r="3"/></svg></span>'
    );
  }

  function chipPlaceLineHtml(place) {
    const name = normalizePlaceName(place);
    if (name === "—") {
      return '<span class="chip-line chip-line--place">' + escapeHtml(name) + "</span>";
    }
    return (
      '<span class="chip-line chip-line--place">' +
      chipPinSvgHtml() +
      '<span class="chip-place-name">' +
      escapeHtml(name) +
      "</span></span>"
    );
  }

  function showLoading(show) {
    $("loadingArea").style.display = show ? "flex" : "none";
    $("calendarArea").style.display = show ? "none" : "grid";
  }

  function setModalLoading(show) {
    $("modalLoading").classList.toggle("visible", !!show);
  }

  function parseLineupDateMeta(dateLabel) {
    const label = String(dateLabel || "").trim();
    const now = new Date();
    let year = now.getFullYear();
    let month = null;
    let day = null;
    let dowJp = "";

    const full = label.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})/);
    if (full) {
      year = parseInt(full[1], 10);
      month = parseInt(full[2], 10);
      day = parseInt(full[3], 10);
    }

    const jp = label.match(/(\d{1,2})月(\d{1,2})日/);
    if (jp) {
      month = parseInt(jp[1], 10);
      day = parseInt(jp[2], 10);
    }

    const dowMatch = label.match(/[（(]([日月火水木金土])[）)]/);
    if (dowMatch) {
      dowJp = "(" + dowMatch[1] + ")";
    } else if (month != null && day != null) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) dowJp = "(" + WEEKDAYS[d.getDay()] + ")";
    }

    let dateMain;
    if (month != null && day != null) {
      dateMain = month + "/" + day;
    } else {
      const withoutDow = label.replace(/[（(][日月火水木金土][）)]/g, "").trim();
      const md = withoutDow.match(/(\d{1,2})[\/．\.](\d{1,2})/);
      if (md) {
        dateMain = parseInt(md[1], 10) + "/" + parseInt(md[2], 10);
      } else {
        const jpOnly = withoutDow.match(/(\d{1,2})月(\d{1,2})日/);
        if (jpOnly) {
          dateMain = parseInt(jpOnly[1], 10) + "/" + parseInt(jpOnly[2], 10);
        } else {
          dateMain = withoutDow || "—";
        }
      }
    }

    return { year: String(year), dateMain: dateMain, dowJp: dowJp };
  }

  function updatePeriodLabel(range) {
    const el = $("periodLabel");
    if (!range || range.startYear == null || range.startMonth == null) {
      el.textContent = "日程を読み込めませんでした";
      return;
    }
    if (
      range.startYear === range.endYear &&
      range.startMonth === range.endMonth
    ) {
      el.textContent = formatYearMonth(range.startYear, range.startMonth);
    } else {
      el.textContent =
        formatYearMonth(range.startYear, range.startMonth) +
        " 〜 " +
        formatYearMonth(range.endYear, range.endMonth);
    }
  }

  function onCalendarLoaded(data) {
    showLoading(false);
    setStatus(null);
    $("errorArea").innerHTML = "";
    $("errorArea").className = "";

    if (!data || typeof data !== "object") {
      onError({ message: "データの取得に失敗しました。しばらくしてから再度お試しください。" });
      return;
    }

    STATE.schedules = Array.isArray(data.sessions) ? data.sessions : [];
    STATE.range = data.range && typeof data.range === "object" ? data.range : null;
    updatePeriodLabel(STATE.range);
    renderCalendars();
  }

  function renderCalendars() {
    const area = $("calendarArea");
    area.innerHTML = "";
    area.style.display = "grid";

    const today = getTodayLocal();
    const m1 = { year: today.getFullYear(), month: today.getMonth() + 1 };

    area.appendChild(buildMonthCalendar(m1.year, m1.month));

    if (shouldShowNextMonth()) {
      const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      area.appendChild(buildMonthCalendar(next.getFullYear(), next.getMonth() + 1));
    }
  }

  function buildMonthCalendar(year, month) {
    const card = document.createElement("section");
    card.className = "month-card";

    const title = document.createElement("div");
    title.className = "month-title";
    title.textContent = year + "年" + month + "月";
    card.appendChild(title);

    const weekdays = document.createElement("div");
    weekdays.className = "weekdays";
    WEEKDAYS.forEach(function (wd, i) {
      const span = document.createElement("span");
      span.textContent = wd;
      if (i === 0) span.className = "sun";
      if (i === 6) span.className = "sat";
      weekdays.appendChild(span);
    });
    card.appendChild(weekdays);

    const daysGrid = document.createElement("div");
    daysGrid.className = "days";

    const first = new Date(year, month - 1, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const allCells = [];

    let p;
    for (p = 0; p < startPad; p++) {
      allCells.push(createEmptyDayCell());
    }

    let d;
    for (d = 1; d <= daysInMonth; d++) {
      allCells.push(createDayCell(year, month, d));
    }

    const totalCells = startPad + daysInMonth;
    const remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    let n;
    for (n = 0; n < remainder; n++) {
      allCells.push(createEmptyDayCell());
    }

    for (let i = 0; i < allCells.length; i += 7) {
      const weekRow = allCells.slice(i, i + 7);
      if (!isWeekFullyPast(weekRow)) {
        weekRow.forEach(function (cell) {
          daysGrid.appendChild(cell);
        });
      }
    }

    card.appendChild(daysGrid);
    return card;
  }

  function getDateKind(year, month, day) {
    const cellDate = stripTime(new Date(year, month - 1, day));
    const today = getTodayLocal();
    if (cellDate.getTime() < today.getTime()) return "past";
    if (cellDate.getTime() === today.getTime()) return "today";
    return "future";
  }

  function getWeekRowLatestDate(cells) {
    let latest = null;
    cells.forEach(function (cell) {
      const y = cell.dataset.year;
      if (!y) return;
      const m = parseInt(cell.dataset.month, 10);
      const d = parseInt(cell.dataset.day, 10);
      const dt = stripTime(new Date(parseInt(y, 10), m - 1, d));
      if (!latest || dt.getTime() > latest.getTime()) latest = dt;
    });
    return latest;
  }

  function isWeekFullyPast(cells) {
    const latest = getWeekRowLatestDate(cells);
    if (!latest) return true;
    return latest.getTime() < getTodayLocal().getTime();
  }

  function createEmptyDayCell() {
    const cell = document.createElement("div");
    cell.className = "day-cell day-cell--empty";
    cell.setAttribute("aria-hidden", "true");
    return cell;
  }

  function createDayCell(year, month, day) {
    const cell = document.createElement("div");
    const classes = ["day-cell"];
    const kind = getDateKind(year, month, day);
    if (kind === "past") classes.push("past");
    else if (kind === "today") classes.push("today");
    cell.className = classes.join(" ");
    cell.dataset.year = String(year);
    cell.dataset.month = String(month);
    cell.dataset.day = String(day);

    const dateObj = new Date(year, month - 1, day);
    const dow = dateObj.getDay();

    const num = document.createElement("div");
    num.className = "day-num";
    if (dow === 0) num.classList.add("sun");
    if (dow === 6) num.classList.add("sat");
    if (typeof isJapaneseHoliday === "function" && isJapaneseHoliday(year, month, day)) {
      num.classList.add("holiday");
      const holidayName =
        typeof getJapaneseHolidayName === "function" ? getJapaneseHolidayName(year, month, day) : "";
      if (holidayName) num.title = holidayName;
    }
    num.textContent = day;
    cell.appendChild(num);

    const events = STATE.schedules.filter(function (s) {
      return s.year === year && s.month === month && s.day === day;
    });
    events.forEach(function (ev) {
      cell.appendChild(createEventChip(ev));
    });

    return cell;
  }

  function formatChipAvailability(ev) {
    const sessionType = ev.sessionType || "individual";
    const max = ev.maxSlots || (sessionType === "team" ? MAX_TEAM_SLOTS : MAX_PARTICIPANTS);
    const filled = ev.filledCount || 0;
    const remaining = max - filled;
    if (sessionType === "team") {
      return { text: "練習試合", isFull: remaining <= 0 };
    }
    if (remaining <= 0) {
      return { text: "満員", isFull: true };
    }
    return { text: "残" + remaining + "名", isFull: false };
  }

  function createEventChip(ev) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "event-chip";
    if (ev.sessionType === "team") {
      btn.classList.add("event-chip--team");
    }
    const avail = formatChipAvailability(ev);
    if (avail.isFull) {
      btn.classList.add("is-full");
    }
    btn.innerHTML =
      chipPlaceLineHtml(ev.place) +
      chipLineHtml(EVENT_TIME_START, "chip-line--time") +
      chipLineHtml(EVENT_TIME_END_LINE, "chip-line--time chip-line--time-end") +
      chipLineHtml(avail.text, "chip-line--count");
    btn.addEventListener("click", function () {
      openDetail(ev.sessionKey);
    });
    return btn;
  }

  function openDetail(sessionKey) {
    STATE.currentSessionKey = sessionKey;
    $("modalFormMessage").textContent = "";

    const local = STATE.schedules.find(function (s) {
      return s.sessionKey === sessionKey;
    });
    if (local) {
      setModalHeader(
        local.dateLabel,
        local.place,
        local.filledCount,
        local.maxSlots,
        local.sessionType,
      );
    }

    $("modalOverlay").classList.add("open");
    $("modalOverlay").setAttribute("aria-hidden", "false");
    setModalLoading(true);

    try {
      const data = getSessionDetail(sessionKey);
      setModalLoading(false);
      onDetailLoaded(data);
    } catch (err) {
      setModalLoading(false);
      onModalError(err);
    }
  }

  function setModalHeader(dateLabel, place, filledCount, maxSlots, sessionType) {
    const isTeam = sessionType === "team";
    const max = maxSlots || (isTeam ? MAX_TEAM_SLOTS : MAX_PARTICIPANTS);
    const meta = parseLineupDateMeta(dateLabel);
    $("modalTitle").textContent = dateLabel || "日程詳細";
    $("modalDateYear").textContent = meta.year;
    $("modalDateMain").textContent = meta.dateMain;
    $("modalDateDow").textContent = meta.dowJp;
    $("modalTimeSlot").textContent = EVENT_TIME_SLOT;
    const placeEl = $("modalPlace");
    const placeText = normalizePlaceName(place);
    placeEl.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
      "<span>" +
      escapeHtml(placeText) +
      "</span>";
    $("modalCount").textContent =
      (isTeam ? "TEAMS " : "ROSTER ") +
      (filledCount != null ? filledCount : "—") +
      " / " +
      max;
    const list = $("participantList");
    if (list) {
      list.classList.toggle("lineup-table--team", isTeam);
    }
    const modal = document.querySelector("#modalOverlay .modal--lineup");
    if (modal) {
      modal.classList.toggle("modal--lineup-team", isTeam);
    }
  }

  function onDetailLoaded(data) {
    const s = data.session;
    const sessionType = s.sessionType || "individual";
    setModalHeader(s.dateLabel, s.place, s.filledCount, s.maxSlots, sessionType);
    renderParticipantSlots(data.slots || [], sessionType, s.maxSlots);
  }

  function appendLineupBadge(parent, text, className, title) {
    const badge = document.createElement("span");
    badge.className = "lineup-badge" + (className ? " " + className : "");
    badge.textContent = text;
    if (title) badge.setAttribute("title", title);
    parent.appendChild(badge);
  }

  function appendLineupParticipantRow(list, slot, options) {
    const opts = options || {};
    const hideBadges = !!opts.hideBadges;
    const li = document.createElement("li");
    li.className = "lineup-row";
    if (opts.extraClass) li.classList.add(opts.extraClass);

    const display = String(slot.display || "").trim();
    const empty = !display;
    if (empty) li.classList.add("lineup-row--empty");
    if (!hideBadges) {
      if (!empty && slot.isFirst) li.classList.add("lineup-row--first");
      if (!empty && slot.isFemale) li.classList.add("lineup-row--female");
      if (!empty && slot.isUnconfirmed) li.classList.add("lineup-row--unconfirmed");
    }

    const orderEl = document.createElement("span");
    orderEl.className = "lineup-order";
    orderEl.textContent = String(slot.seq || "");
    li.appendChild(orderEl);

    if (!hideBadges) {
      const badgesEl = document.createElement("span");
      badgesEl.className = "lineup-badges";
      if (empty) {
        appendLineupBadge(badgesEl, "—", "lineup-badge--empty", "");
      } else {
        if (slot.isFirst) appendLineupBadge(badgesEl, "初", "lineup-badge--first", "初参加");
        if (slot.isFemale) appendLineupBadge(badgesEl, "女", "lineup-badge--female", "女性");
        if (slot.isUnconfirmed) appendLineupBadge(badgesEl, "未", "lineup-badge--pending", "未確定");
        if (!slot.isFirst && !slot.isFemale && !slot.isUnconfirmed) {
          appendLineupBadge(badgesEl, "—", "lineup-badge--empty", "");
        }
      }
      li.appendChild(badgesEl);
    }

    const nameEl = document.createElement("span");
    nameEl.className = "lineup-name";
    nameEl.textContent = empty ? "—" : display;
    li.appendChild(nameEl);

    list.appendChild(li);
    return li;
  }

  function renderParticipantSlots(slots, sessionType, maxSlots) {
    const list = $("participantList");
    list.innerHTML = "";
    const isTeam = sessionType === "team";
    const slotLimit = isTeam ? maxSlots || MAX_TEAM_SLOTS : slots.length;

    for (let index = 0; index < slotLimit; index++) {
      const slot = slots[index] || {
        seq: index + 1,
        display: "",
        isFirst: false,
        isFemale: false,
        isUnconfirmed: false,
        members: [],
      };

      const li = document.createElement("li");
      li.className = "lineup-row";
      if (isTeam) li.classList.add("lineup-row--team");
      const display = String(slot.display || "").trim();
      const empty = !display;

      if (empty) li.classList.add("lineup-row--empty");
      if (!empty && slot.isFirst) li.classList.add("lineup-row--first");
      if (!empty && slot.isFemale) li.classList.add("lineup-row--female");
      if (!empty && slot.isUnconfirmed) li.classList.add("lineup-row--unconfirmed");

      const orderEl = document.createElement("span");
      orderEl.className = "lineup-order";
      if (isTeam) {
        orderEl.textContent = TEAM_SLOT_LABELS[index] || "チーム";
        orderEl.classList.add("lineup-order--team");
      } else {
        orderEl.textContent = String(slot.seq || index + 1);
      }
      li.appendChild(orderEl);

      if (!isTeam) {
        const badgesEl = document.createElement("span");
        badgesEl.className = "lineup-badges";
        if (empty) {
          appendLineupBadge(badgesEl, "—", "lineup-badge--empty", "");
        } else {
          if (slot.isFirst) appendLineupBadge(badgesEl, "初", "lineup-badge--first", "初参加");
          if (slot.isFemale) appendLineupBadge(badgesEl, "女", "lineup-badge--female", "女性");
          if (slot.isUnconfirmed) appendLineupBadge(badgesEl, "未", "lineup-badge--pending", "未確定");
          if (!slot.isFirst && !slot.isFemale && !slot.isUnconfirmed) {
            appendLineupBadge(badgesEl, "—", "lineup-badge--empty", "");
          }
        }
        li.appendChild(badgesEl);
      }

      const nameEl = document.createElement("span");
      nameEl.className = "lineup-name";
      nameEl.textContent = empty ? "—" : display;
      li.appendChild(nameEl);

      list.appendChild(li);

      if (isTeam && index === 0 && display) {
        const members = Array.isArray(slot.members) ? slot.members : [];
        members.forEach(function (member) {
          appendLineupParticipantRow(list, member, {
            extraClass: "lineup-row--member",
            hideBadges: true,
          });
        });
      }
    }
  }

  function closeModal() {
    setModalLoading(false);
    $("modalOverlay").classList.remove("open");
    $("modalOverlay").setAttribute("aria-hidden", "true");
    const modal = document.querySelector("#modalOverlay .modal--lineup");
    if (modal) modal.classList.remove("modal--lineup-team");
    STATE.currentSessionKey = null;
  }

  function onError(err) {
    showLoading(false);
    const area = $("errorArea");
    area.className = "error-banner";
    let msg = formatUserError(err);
    if (msg === "undefined" || msg.indexOf("undefined") >= 0) {
      msg =
        "データの取得に失敗しました。スプレッドシートの公開設定と record シートを確認してください。";
    }
    area.textContent = msg;
    $("periodLabel").textContent = "読み込みエラー";
    setStatus("error", msg);
  }

  function onModalError(err) {
    $("modalFormMessage").textContent =
      err && err.message ? String(err.message) : String(err);
  }

  async function bootstrap(skipCache) {
    const btn = $("btnRefresh");
    if (btn) btn.disabled = true;
    showLoading(true);
    setStatus("loading", "読み込み中…");
    $("errorArea").innerHTML = "";
    $("errorArea").className = "";

    try {
      const data = await loadCalendarData(!!skipCache);
      onCalendarLoaded(data);
    } catch (err) {
      onError(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function initClubInfoTabs() {
    var tablist = document.querySelector(".club-info-tabs");
    if (!tablist) return;

    var tabs = tablist.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll(".club-info-tab-panel");

    function activateTab(tab) {
      var targetId = tab.getAttribute("aria-controls");
      var panelRoot = tablist.closest(".club-info-panel");
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", selected ? "true" : "false");
        t.tabIndex = selected ? 0 : -1;
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.id !== targetId;
      });
      if (panelRoot) {
        panelRoot.classList.toggle(
          "club-info-panel--practice-active",
          tab.getAttribute("data-tab") === "practice"
        );
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab);
      });
      tab.addEventListener("keydown", function (e) {
        var index = Array.prototype.indexOf.call(tabs, tab);
        var next = -1;
        if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
        else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        if (next >= 0) {
          e.preventDefault();
          tabs[next].focus();
          activateTab(tabs[next]);
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initClubInfoTabs();
    $("modalTimeSlot").textContent = EVENT_TIME_SLOT;
    $("closeModalBtn").addEventListener("click", closeModal);
    $("modalOverlay").addEventListener("click", function (e) {
      if (e.target === $("modalOverlay")) {
        closeModal();
      }
    });

    const btnRefresh = $("btnRefresh");

    if (window.__MOCK_CALENDAR__) {
      var mock = window.__MOCK_CALENDAR__;
      var mockLoadDelayMs = 1200;

      async function loadMockCalendar() {
        if (btnRefresh) btnRefresh.disabled = true;
        showLoading(true);
        setStatus("loading", "読み込み中…");
        $("errorArea").innerHTML = "";
        $("errorArea").className = "";
        await new Promise(function (resolve) {
          setTimeout(resolve, mockLoadDelayMs);
        });
        if (mock.groupByKey && typeof mock.groupByKey === "object") {
          STATE.groupByKey = mock.groupByKey;
        }
        onCalendarLoaded(mock);
        if (btnRefresh) btnRefresh.disabled = false;
      }

      if (btnRefresh) {
        btnRefresh.addEventListener("click", function () {
          loadMockCalendar();
        });
      }
      loadMockCalendar();
      return;
    }

    if (btnRefresh) {
      btnRefresh.addEventListener("click", async function () {
        await clearBundleCache();
        await bootstrap(true);
      });
    }

    bootstrap(false);
  });
})();