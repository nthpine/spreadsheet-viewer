/**

 * NORTH PINE 募集画像（GitHub Pages + GAS JSON API）

 */

(function () {

  "use strict";



  const SPREADSHEET_ID = "1-07mnQUToyJjD2pNau99a0dCLmg_0chswzvv3eW4t30";

  const RECORD_SHEET_NAME = "record";

  const MAX_SLOTS = 15;

  const MAX_TEAM_SLOTS = 3;

  const DEFAULT_PLACE = "中央体育館";

  const LOGO_URL = "NORTHPINE_背景なし.png";

  const EVENT_TIME_DISPLAY = "19:15 - 21:45";

  const GUIDE_LINE1 = "参加希望の方は固定ポストを確認後、";

  const GUIDE_LINE2 = "DMまでお願いします！";

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  const CANVAS_W = 1080;

  const CANVAS_H = 1920;

  const SCALE = 3;



  const FONT_ORBITRON = "Orbitron, sans-serif";

  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';



  const LOGO_DISPLAY_W = 420;

  const RECRUIT_NUM_PX = 72;

  const RECRUIT_SUFFIX_PX = 48;



  const COLOR_MAIN = "#ffffff";

  const COLOR_ACCENT = "#b9ddf4";

  const COLOR_MUTED = "#b0bac6";

  const COLOR_BOT_POST = "#d1d9e0";

  const BG_TOP = "#111827";

  const BG_MID = "#1c2330";

  const BG_BOTTOM = "#242b35";

  const BG_MARGIN = "#3a4554";

  const NOTE_FONT_SIZE = 14;

  const NOTE_BOX_PAD_X = 12 * SCALE;

  const NOTE_BOX_PAD_Y = 8 * SCALE;

  const NOTE_BOX_RADIUS = 8 * SCALE;

  const NOTE_BOX_STROKE = 2 * SCALE;

  const GUIDE_BOX_WIDTH = CANVAS_W - 200;

  const GUIDE_BOX_PAD_Y = 18 * SCALE;

  const GUIDE_BACKGROUND = "rgba(9, 20, 37, 0.48)";

  const MIN_TOP_PAD = 72;

  const MIN_BOTTOM_PAD = 180;

  const FOOTER_FIRST_LINE_Y_DEFAULT = CANVAS_H - 230;

  const INFO_BLOCK_SHIFT_UP = 65;



  const F_RECRUIT_NUM = "900 " + RECRUIT_NUM_PX * SCALE + "px " + FONT_ORBITRON;

  const F_RECRUIT_SUFFIX = "900 " + RECRUIT_SUFFIX_PX * SCALE + "px " + FONT_JP;

  const F_DATE_MAIN = "700 " + 36 * SCALE + "px " + FONT_ORBITRON;

  const F_DATE_DAY = "500 " + 20 * SCALE + "px " + FONT_JP;

  const F_TIME = "500 " + 20 * SCALE + "px " + FONT_ORBITRON;

  const F_PLACE = "700 " + 28 * SCALE + "px " + FONT_JP;

  const F_FOOTER = "500 " + 14 * SCALE + "px " + FONT_JP;

  const F_BOT_POST = "500 " + 11 * SCALE + "px " + FONT_JP;

  const F_NOTE = "500 " + NOTE_FONT_SIZE * SCALE + "px " + FONT_JP;



  const NOTE_MAX_WIDTH = CANVAS_W - 200;

  const NOTE_LINE_HEIGHT = NOTE_FONT_SIZE * SCALE * 1.55;



  const FOOTER_LINE_H = 14 * SCALE * 1.6;

  const BOT_TEXT_H = 11 * SCALE;



  const GAP_BOT_LABEL = 20 * SCALE;

  const GAP_LOGO_RECRUIT = 48 * SCALE;

  const GAP_RECRUIT = 40 * SCALE;

  const GAP_DATE = 16 * SCALE;

  const GAP_TIME = 28 * SCALE;

  const GAP_PLACE = 32 * SCALE;

  const GAP_NOTE = 32 * SCALE;

  const GAP_FOOTER = 40 * SCALE;

  const NUM_SUFFIX_GAP = 4 * SCALE;

  const ORBITRON_TRACKING = "-0.02em";



  const canvas = document.getElementById("exportCanvas");

  const ctx = canvas.getContext("2d");

  const saveImageEl = document.getElementById("saveImage");



  let lastPngDataUrl = "";

  let drawTimer = null;

  let ready = false;

  let logoImage = null;

  let logoReady = false;

  let fontsReady = false;



  function getGasWebAppUrl() {

    const meta = document.querySelector('meta[name="gas-web-app-url"]');

    return meta ? String(meta.getAttribute("content") || "").trim() : "";

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

          "データの取得に失敗しました。invite.html を直接開かず、" +

          "ローカルサーバー（例: npx serve）または GitHub Pages で開いてください。"

        );

      }

      return "データの取得に失敗しました。ネットワークと GAS の URL を確認してください。";

    }

    return msg;

  }



  function todayIso() {

    const t = new Date();

    return (

      t.getFullYear() +

      "-" +

      ("0" + (t.getMonth() + 1)).slice(-2) +

      "-" +

      ("0" + t.getDate()).slice(-2)

    );

  }



  function clampFilled(n) {

    const v = parseInt(String(n), 10);

    if (!Number.isFinite(v)) return 0;

    return Math.min(MAX_SLOTS, Math.max(0, v));

  }



  function getRecruitingCount(filled) {

    return Math.max(0, MAX_SLOTS - clampFilled(filled));

  }



  function normalizePlaceName(place) {

    const p = String(place || "").trim();

    if (!p || p === "—") return "—";

    return p.replace(/^[@＠]+/, "").trim() || "—";

  }



  function parseDateParts(iso) {

    if (!iso) return null;

    const parts = String(iso).split("-");

    if (parts.length !== 3) return null;

    const y = parseInt(parts[0], 10);

    const m = parseInt(parts[1], 10);

    const d = parseInt(parts[2], 10);

    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    const dt = new Date(y, m - 1, d);

    return { m: m, d: d, weekday: WEEKDAYS[dt.getDay()] };

  }



  function pickInviteSession(sessions, todayIsoStr) {

    if (!sessions || !sessions.length) return null;

    let todaySession = null;

    let nearestFuture = null;

    for (let i = 0; i < sessions.length; i++) {

      const s = sessions[i];

      if (!s || !s.dateIso) continue;

      if (s.dateIso === todayIsoStr) {

        todaySession = s;

        break;

      }

      if (s.dateIso >= todayIsoStr) {

        if (!nearestFuture || s.dateIso < nearestFuture.dateIso) {

          nearestFuture = s;

        }

      }

    }

    return todaySession || nearestFuture || null;

  }



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



  function normalizeParticipantDisplay(s) {

    let t = String(s == null ? "" : s);

    t = t.replace(/\u200b|\u200c|\u200d|\ufeff/g, "");

    t = t.replace(/\u00a0|\u3000/g, " ");

    t = t.replace(/\s+/g, " ").trim();

    return t;

  }



  function buildSessionGroupsFromRows(rows) {

    const groups = {};



    for (let i = 0; i < rows.length; i++) {

      const row = rows[i];

      const dateRaw = String(row[1] || "").trim();

      if (!dateRaw) continue;

      const placeRaw = String(row[2] || "").trim() || "—";

      const key = dateRaw + "\t" + placeRaw;



      if (!groups[key]) {

        groups[key] = {

          dateRaw: dateRaw,

          place: placeRaw,

          bySeq: {},

        };

      }



      const seq = parseInt(String(row[0] || "").trim(), 10);

      const slotIndex =

        Number.isFinite(seq) && seq >= 1 && seq <= MAX_SLOTS ? seq - 1 : null;

      if (slotIndex === null) continue;



      groups[key].bySeq[slotIndex] = {

        display: normalizeParticipantDisplay(row[3]),

      };

    }



    return groups;

  }



  function groupsToSlotsArray(bySeq) {

    const slots = [];

    for (let i = 0; i < MAX_SLOTS; i++) {

      if (bySeq[i]) {

        slots.push(bySeq[i]);

      } else {

        slots.push({ display: "" });

      }

    }

    return slots;

  }



  function detectSessionType(bySeq) {

    for (let i = 3; i < MAX_SLOTS; i++) {

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

    const limit = sessionType === "team" ? maxSlots || MAX_TEAM_SLOTS : MAX_SLOTS;

    let n = 0;

    for (let i = 0; i < limit; i++) {

      if (slots[i] && normalizeParticipantDisplay(slots[i].display)) n++;

    }

    return n;

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



  function getTodayLocal() {

    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());

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



  async function loadSessionsFromCsv() {

    const text = await fetchSheetText(RECORD_SHEET_NAME);

    if (!text) {

      throw new Error(

        "record シートの取得に失敗しました。スプレッドシートが「リンクを知っている全員が閲覧可」になっているか確認してください。",

      );

    }



    const rows = parseCSV(text);

    const dataRows = readRecordRowsFromCsv(rows);

    const groups = buildSessionGroupsFromRows(dataRows);

    const sessions = [];



    for (const key of Object.keys(groups)) {

      const group = groups[key];

      const eventDate = parseRecordDate(group.dateRaw);

      if (!eventDate) continue;



      const sessionType = detectSessionType(group.bySeq);

      const slots = groupsToSlotsArray(group.bySeq);

      const maxSlots = sessionType === "team" ? getTeamMaxSlots(group.bySeq) : MAX_SLOTS;

      const filledCount = countFilledSlotsForSession(slots, sessionType, maxSlots);



      sessions.push({

        dateIso: formatDateIso(eventDate),

        place: group.place,

        filledCount: filledCount,

      });

    }



    sessions.sort(function (a, b) {

      return a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0;

    });



    return sessions;

  }



  function bootstrapFromSessions(sessions) {

    const iso = todayIso();

    const picked = pickInviteSession(sessions, iso);

    if (picked) {

      return {

        dateIso: picked.dateIso,

        place:

          picked.place && picked.place !== "—"

            ? normalizePlaceName(picked.place)

            : DEFAULT_PLACE,

        filledCount: clampFilled(picked.filledCount),

      };

    }

    return { dateIso: iso, place: DEFAULT_PLACE, filledCount: 0 };

  }



  function getFormState() {

    const dateIso = document.getElementById("inputDate").value;

    const place = document.getElementById("inputPlace").value.trim();

    const filled = clampFilled(document.getElementById("inputFilled").value);

    const recruiting = getRecruitingCount(filled);

    const botPostEl = document.getElementById("inputBotPost");

    const noteEl = document.getElementById("inputNote");

    const botPost = botPostEl ? botPostEl.checked : true;

    const note = noteEl ? noteEl.value.trim() : "";

    return {

      dateIso: dateIso,

      dateParts: parseDateParts(dateIso),

      placeName: normalizePlaceName(place),

      filledCount: filled,

      recruiting: recruiting,

      recruitText: recruiting + "名募集中",

      botPost: botPost,

      note: note,

    };

  }



  function updateRecruitDisplay() {

    document.getElementById("recruitValue").textContent = getFormState().recruitText;

  }



  function scheduleDraw() {

    if (!ready || !logoReady || !fontsReady) return;

    if (drawTimer) clearTimeout(drawTimer);

    drawTimer = setTimeout(function () {

      drawTimer = null;

      drawStory();

    }, 80);

  }



  function loadLogoImage() {

    logoImage = new Image();

    logoImage.onload = function () {

      logoReady = true;

      if (ready && fontsReady) drawStory();

    };

    logoImage.onerror = function () {

      logoReady = true;

      if (ready && fontsReady) drawStory();

    };

    logoImage.src = LOGO_URL;

  }



  function loadCanvasFonts() {

    function onFontsDone() {

      fontsReady = true;

      if (ready && logoReady) drawStory();

    }

    if (!document.fonts || !document.fonts.load) {

      onFontsDone();

      return;

    }

    Promise.all([

      document.fonts.load(F_RECRUIT_NUM),

      document.fonts.load(F_RECRUIT_SUFFIX),

      document.fonts.load(F_DATE_MAIN),

      document.fonts.load(F_DATE_DAY),

      document.fonts.load(F_TIME),

      document.fonts.load(F_PLACE),

      document.fonts.load(F_FOOTER),

      document.fonts.load(F_BOT_POST),

      document.fonts.load(F_NOTE),

    ])

      .then(function () {

        return document.fonts.ready;

      })

      .then(onFontsDone)

      .catch(onFontsDone);

  }



  function drawGradientBackground(ctx2d) {

    const grad = ctx2d.createLinearGradient(0, 0, 0, CANVAS_H);

    grad.addColorStop(0, BG_TOP);

    grad.addColorStop(0.5, BG_MID);

    grad.addColorStop(0.88, BG_BOTTOM);

    grad.addColorStop(1, BG_MARGIN);

    ctx2d.fillStyle = grad;

    ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);

  }



  function scaledGap(gapPx, gapScale) {

    return gapPx * gapScale;

  }



  function measureNoteBoxWidth(lines) {

    ctx.font = F_NOTE;

    let textWidth = 0;

    for (let i = 0; i < lines.length; i++) {

      textWidth = Math.max(textWidth, ctx.measureText(lines[i]).width);

    }

    return textWidth + NOTE_BOX_PAD_X * 2;

  }



  function getGuideBox(firstLineY) {

    const top = firstLineY - FOOTER_LINE_H / 2 - GUIDE_BOX_PAD_Y;

    const height = FOOTER_LINE_H * 2 + GUIDE_BOX_PAD_Y * 2;

    return {

      x: (CANVAS_W - GUIDE_BOX_WIDTH) / 2,

      y: top,

      width: GUIDE_BOX_WIDTH,

      height: height,

    };

  }



  function buildVerticalLayout(state, gapScale, footerFirstLineY) {

    const pos = { noteLines: [] };

    let y = footerFirstLineY;



    y -= FOOTER_LINE_H / 2 + GUIDE_BOX_PAD_Y;

    y -= scaledGap(GAP_FOOTER, gapScale);



    if (state.note) {

      const lines = wrapNoteLines(state.note);

      if (lines.length) {

        y -= scaledGap(GAP_NOTE, gapScale);

        y -= NOTE_BOX_PAD_Y;

        for (let i = lines.length - 1; i >= 0; i--) {

          y -= NOTE_LINE_HEIGHT / 2;

          pos.noteLines.unshift({ y: y, text: lines[i] });

          y -= NOTE_LINE_HEIGHT / 2;

        }

        y -= NOTE_BOX_PAD_Y;

        const noteBoxWidth = measureNoteBoxWidth(lines);

        pos.noteBox = {

          x: (CANVAS_W - noteBoxWidth) / 2,

          y: y,

          width: noteBoxWidth,

          height: lines.length * NOTE_LINE_HEIGHT + NOTE_BOX_PAD_Y * 2,

        };

      }

    }



    y -= scaledGap(GAP_PLACE, gapScale);

    const placeLineHeight = 28 * SCALE;

    y -= placeLineHeight / 2;

    pos.placeY = y;

    y -= placeLineHeight / 2;



    y -= scaledGap(GAP_TIME, gapScale);

    const timeLineHeight = 20 * SCALE;

    y -= timeLineHeight / 2;

    pos.timeY = y;

    y -= timeLineHeight / 2;



    y -= scaledGap(GAP_DATE, gapScale);

    const dateLineHeight = 36 * SCALE;

    y -= dateLineHeight / 2;

    pos.dateY = y;

    y -= dateLineHeight / 2;



    y -= scaledGap(GAP_RECRUIT, gapScale);

    y -= (RECRUIT_NUM_PX * SCALE) / 2;

    pos.recruitY = y;

    y -= (RECRUIT_NUM_PX * SCALE) / 2;



    const logoH = measureLogoHeight();

    if (logoH > 0) {

      y -= scaledGap(GAP_LOGO_RECRUIT, gapScale);

      y -= logoH / 2;

      pos.logoY = y;

      y -= logoH / 2;

    }



    if (state.botPost) {

      y -= scaledGap(GAP_BOT_LABEL, gapScale);

      y -= BOT_TEXT_H / 2;

      pos.botY = y;

      y -= BOT_TEXT_H / 2;

    }



    pos.topEdge = y;

    pos.guideBox = getGuideBox(footerFirstLineY);

    pos.footerBottom = pos.guideBox.y + pos.guideBox.height;

    shiftInfoBlockUp(pos);

    return pos;

  }



  function shiftInfoBlockUp(pos) {

    if (!INFO_BLOCK_SHIFT_UP) return;

    if (pos.recruitY != null) pos.recruitY -= INFO_BLOCK_SHIFT_UP;

    if (pos.dateY != null) pos.dateY -= INFO_BLOCK_SHIFT_UP;

    if (pos.timeY != null) pos.timeY -= INFO_BLOCK_SHIFT_UP;

    if (pos.placeY != null) pos.placeY -= INFO_BLOCK_SHIFT_UP;

  }



  function resolveVerticalLayout(state) {

    let gapScale = 1;

    let footerFirstLineY = FOOTER_FIRST_LINE_Y_DEFAULT;

    let positions = buildVerticalLayout(state, gapScale, footerFirstLineY);



    while (positions.topEdge < MIN_TOP_PAD && gapScale > 0.1) {

      gapScale -= 0.05;

      positions = buildVerticalLayout(state, gapScale, footerFirstLineY);

    }



    while (positions.topEdge < MIN_TOP_PAD) {

      footerFirstLineY += MIN_TOP_PAD - positions.topEdge;

      positions = buildVerticalLayout(state, gapScale, footerFirstLineY);

      if (footerFirstLineY > CANVAS_H) break;

    }



    return {

      positions: positions,

      gapScale: gapScale,

      footerFirstLineY: footerFirstLineY,

    };

  }



  function textShadowOn() {

    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";

    ctx.shadowBlur = 3;

    ctx.shadowOffsetX = 0;

    ctx.shadowOffsetY = 1;

  }



  function textShadowOff() {

    ctx.shadowBlur = 0;

    ctx.shadowOffsetY = 0;

  }



  function measureLogoHeight() {

    if (!logoImage || !logoImage.naturalWidth) return 0;

    return LOGO_DISPLAY_W * (logoImage.naturalHeight / logoImage.naturalWidth);

  }



  function measureRecruitWidth(num) {

    const numStr = String(num);

    const mei = "名";

    const suffix = "募集中";

    ctx.font = F_RECRUIT_NUM;

    ctx.letterSpacing = ORBITRON_TRACKING;

    const nw = ctx.measureText(numStr).width;

    ctx.letterSpacing = "0px";

    ctx.font = F_RECRUIT_SUFFIX;

    const mw = ctx.measureText(mei).width;

    const sw = ctx.measureText(suffix).width;

    return nw + NUM_SUFFIX_GAP + mw + sw;

  }



  function measureDateWidth(parts) {

    if (!parts) {

      ctx.font = F_DATE_MAIN;

      return ctx.measureText("—").width;

    }

    const main = parts.m + "/" + parts.d;

    const day = "(" + parts.weekday + ")";

    ctx.font = F_DATE_MAIN;

    ctx.letterSpacing = ORBITRON_TRACKING;

    const mw = ctx.measureText(main).width;

    ctx.letterSpacing = "0px";

    ctx.font = F_DATE_DAY;

    const dw = ctx.measureText(day).width;

    return mw + 8 * SCALE + dw;

  }



  function drawDateLine(cx, y, parts) {

    if (!parts) {

      drawCenteredText(cx, y, "—", F_DATE_MAIN, COLOR_MAIN);

      return;

    }

    const main = parts.m + "/" + parts.d;

    const day = "(" + parts.weekday + ")";

    const totalW = measureDateWidth(parts);

    let x = cx - totalW / 2;



    ctx.textAlign = "left";

    ctx.textBaseline = "middle";

    textShadowOn();

    ctx.font = F_DATE_MAIN;

    ctx.fillStyle = COLOR_MAIN;

    ctx.letterSpacing = ORBITRON_TRACKING;

    ctx.fillText(main, x, y);

    ctx.letterSpacing = "0px";

    x += ctx.measureText(main).width + 8 * SCALE;

    ctx.font = F_DATE_DAY;

    ctx.fillStyle = COLOR_MUTED;

    ctx.fillText(day, x, y);

    textShadowOff();

  }

  function wrapNoteLines(note) {

    if (!note) return [];

    ctx.font = F_NOTE;

    const lines = [];

    let line = "";

    for (let i = 0; i < note.length; i++) {

      const test = line + note[i];

      if (ctx.measureText(test).width > NOTE_MAX_WIDTH && line) {

        lines.push(line);

        line = note[i];

      } else {

        line = test;

      }

    }

    if (line) lines.push(line);

    return lines;

  }



  function drawLogo(cx, centerY) {

    if (!logoImage || !logoImage.naturalWidth) return;

    const w = LOGO_DISPLAY_W;

    const h = w * (logoImage.naturalHeight / logoImage.naturalWidth);

    ctx.drawImage(logoImage, cx - w / 2, centerY - h / 2, w, h);

  }



  function drawRecruitLine(cx, y, num) {

    const numStr = String(num);

    const mei = "名";

    const suffix = "募集中";

    const totalW = measureRecruitWidth(num);

    let x = cx - totalW / 2;



    ctx.textBaseline = "middle";

    ctx.textAlign = "left";

    textShadowOn();



    ctx.font = F_RECRUIT_NUM;

    ctx.fillStyle = COLOR_ACCENT;

    ctx.letterSpacing = ORBITRON_TRACKING;

    ctx.fillText(numStr, x, y);

    ctx.letterSpacing = "0px";

    x += ctx.measureText(numStr).width + NUM_SUFFIX_GAP;



    ctx.font = F_RECRUIT_SUFFIX;

    ctx.fillStyle = COLOR_ACCENT;

    ctx.fillText(mei, x, y);

    x += ctx.measureText(mei).width;



    ctx.fillStyle = COLOR_MAIN;

    ctx.fillText(suffix, x, y);

    textShadowOff();

  }



  function drawCenteredText(cx, y, text, font, color) {

    ctx.font = font;

    ctx.fillStyle = color;

    ctx.textAlign = "center";

    ctx.textBaseline = "middle";

    textShadowOn();

    ctx.fillText(text, cx, y);

    textShadowOff();

  }



  function drawTimeLine(cx, y) {

    drawCenteredText(cx, y, EVENT_TIME_DISPLAY, F_TIME, COLOR_MAIN);

  }



  function drawPlaceLine(cx, y, name) {

    drawCenteredText(cx, y, normalizePlaceName(name), F_PLACE, COLOR_MAIN);

  }



  function roundedRectPath(x, y, width, height, radius) {

    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();

    if (typeof ctx.roundRect === "function") {

      ctx.roundRect(x, y, width, height, r);

      return;

    }

    ctx.moveTo(x + r, y);

    ctx.lineTo(x + width - r, y);

    ctx.quadraticCurveTo(x + width, y, x + width, y + r);

    ctx.lineTo(x + width, y + height - r);

    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);

    ctx.lineTo(x + r, y + height);

    ctx.quadraticCurveTo(x, y + height, x, y + height - r);

    ctx.lineTo(x, y + r);

    ctx.quadraticCurveTo(x, y, x + r, y);

    ctx.closePath();

  }



  function drawNoteBox(box) {

    if (!box) return;

    ctx.save();

    ctx.strokeStyle = COLOR_ACCENT;

    ctx.lineWidth = NOTE_BOX_STROKE;

    ctx.globalAlpha = 0.9;

    roundedRectPath(box.x, box.y, box.width, box.height, NOTE_BOX_RADIUS);

    ctx.stroke();

    ctx.restore();

  }



  function drawFooter(cx, y, guideBox) {

    if (guideBox) {

      ctx.save();

      ctx.fillStyle = GUIDE_BACKGROUND;

      ctx.fillRect(guideBox.x, guideBox.y, guideBox.width, guideBox.height);

      ctx.restore();

    }

    drawCenteredText(cx, y, GUIDE_LINE1, F_FOOTER, COLOR_MAIN);

    drawCenteredText(cx, y + FOOTER_LINE_H, GUIDE_LINE2, F_FOOTER, COLOR_MAIN);

  }



  function drawBotPostLabel(cx, y) {

    drawCenteredText(cx, y, "Botによる自動投稿", F_BOT_POST, COLOR_BOT_POST);

  }



  function drawStory() {

    if (!logoReady || !fontsReady) return;



    const state = getFormState();

    drawGradientBackground(ctx);



    const layout = resolveVerticalLayout(state);

    const pos = layout.positions;

    const cx = CANVAS_W / 2;



    if (state.botPost && pos.botY != null) {

      drawBotPostLabel(cx, pos.botY);

    }



    if (pos.logoY != null) {

      drawLogo(cx, pos.logoY);

    }



    drawRecruitLine(cx, pos.recruitY, state.recruiting);

    drawDateLine(cx, pos.dateY, state.dateParts);

    drawTimeLine(cx, pos.timeY);

    drawPlaceLine(cx, pos.placeY, state.placeName);

    drawNoteBox(pos.noteBox);



    for (let i = 0; i < pos.noteLines.length; i++) {

      const line = pos.noteLines[i];

      drawCenteredText(cx, line.y, line.text, F_NOTE, COLOR_MAIN);

    }



    drawFooter(cx, layout.footerFirstLineY, pos.guideBox);

    syncSaveImageFromCanvas();

  }



  function syncSaveImageFromCanvas() {

    try {

      lastPngDataUrl = canvas.toDataURL("image/png");

      saveImageEl.src = lastPngDataUrl;

    } catch (e) {

      lastPngDataUrl = "";

    }

  }



  function applyBootstrap(data) {

    if (!data) return;

    if (data.dateIso) document.getElementById("inputDate").value = data.dateIso;

    if (data.place) {

      document.getElementById("inputPlace").value = normalizePlaceName(data.place);

    }

    if (data.filledCount != null) {

      document.getElementById("inputFilled").value = clampFilled(data.filledCount);

    }

    updateRecruitDisplay();

  }



  function showReady() {

    document.getElementById("loadingArea").style.display = "none";

    document.getElementById("appContent").classList.add("ready");

    ready = true;

    if (logoReady && fontsReady) drawStory();

  }



  function showError(msg) {

    document.getElementById("loadingArea").style.display = "none";

    document.getElementById("appContent").classList.add("ready");

    const el = document.getElementById("statusMsg");

    el.textContent = msg;

    el.className = "invite-status error";

    ready = true;

    if (logoReady && fontsReady) drawStory();

  }



  function bindEvents() {

    ["inputDate", "inputPlace", "inputFilled"].forEach(function (id) {

      const el = document.getElementById(id);

      el.addEventListener("input", function () {

        updateRecruitDisplay();

        scheduleDraw();

      });

      el.addEventListener("change", function () {

        updateRecruitDisplay();

        scheduleDraw();

      });

    });



    ["inputBotPost", "inputNote"].forEach(function (id) {

      const el = document.getElementById(id);

      if (!el) return;

      el.addEventListener("input", scheduleDraw);

      el.addEventListener("change", scheduleDraw);

    });

  }



  async function loadBootstrap() {

    const fallback = { dateIso: todayIso(), place: DEFAULT_PLACE, filledCount: 0 };

    const apiUrl = gasCalendarApiUrl();



    if (apiUrl) {

      try {

        const res = await fetch(apiUrl);

        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();

        if (!data || data.ok === false) {

          throw new Error((data && data.error) || "データの取得に失敗しました。");

        }

        applyBootstrap(bootstrapFromSessions(data.sessions || []));

        showReady();

        return;

      } catch (_) {

        /* GAS 失敗時は CSV へフォールバック */

      }

    }



    try {

      const sessions = await loadSessionsFromCsv();

      applyBootstrap(bootstrapFromSessions(sessions));

      showReady();

    } catch (err) {

      const msg = apiUrl

        ? formatUserError(err) + " — 手動で入力して利用できます。"

        : "GAS URL が未設定です。手動で入力して利用できます。";

      showError(msg);

      applyBootstrap(fallback);

      showReady();

    }

  }



  document.addEventListener("DOMContentLoaded", function () {

    loadLogoImage();

    loadCanvasFonts();

    bindEvents();

    loadBootstrap();

  });

})();
