/**
 * NORTH PINE 募集画像（GitHub Pages + GAS JSON API）
 */
(function () {
  "use strict";

  const MAX_SLOTS = 15;
  const DEFAULT_PLACE = "中央体育館";
  const INVITE_BG_URL = "invite-background.png";
  const EVENT_TIME_DISPLAY = "19:15 - 21:45";
  const GUIDE_LINE1 = "参加希望の方は固定ポストを確認後、";
  const GUIDE_LINE2 = "DMまでお願いします！";
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const SCALE = 3;

  const FONT_ORBITRON = "Orbitron, sans-serif";
  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';

  const RECRUIT_NUM_PX = 58;
  const RECRUIT_SUFFIX_PX = 42;
  const PLACE_PIN_PX = 26;
  const PLACE_PIN_GAP = 8;

  const PIN_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/>' +
    '<circle cx="12" cy="10" r="3"/></svg>';

  const COLOR_MAIN = "#ffffff";
  const COLOR_ACCENT = "#ffffff";
  const COLOR_MUTED = "#666666";
  const TEXT_REGION_TOP = CANVAS_H / 2;
  const TEXT_REGION_PAD_BOTTOM = 80;

  const F_RECRUIT_NUM = "900 " + RECRUIT_NUM_PX * SCALE + "px " + FONT_ORBITRON;
  const F_RECRUIT_SUFFIX = "900 " + RECRUIT_SUFFIX_PX * SCALE + "px " + FONT_JP;
  const F_DATE_MAIN = "900 " + 40 * SCALE + "px " + FONT_ORBITRON;
  const F_DATE_DAY = "900 " + 22 * SCALE + "px " + FONT_JP;
  const F_TIME = "700 " + 18 * SCALE + "px " + FONT_ORBITRON;
  const F_PLACE = "900 " + 30 * SCALE + "px " + FONT_JP;
  const F_FOOTER = "700 " + 15 * SCALE + "px " + FONT_JP;

  const GAP_RECRUIT = 30 * SCALE;
  const GAP_DATE = 2 * SCALE;
  const GAP_TIME = 25 * SCALE;
  const GAP_PLACE = 40 * SCALE;
  const NUM_SUFFIX_GAP = 3 * SCALE;
  const ORBITRON_TRACKING = "-0.03em";

  const canvas = document.getElementById("exportCanvas");
  const ctx = canvas.getContext("2d");
  const saveImageEl = document.getElementById("saveImage");

  let lastPngDataUrl = "";
  let drawTimer = null;
  let ready = false;
  let bgImage = null;
  let bgReady = false;
  let fontsReady = false;
  let pinIcon = null;
  let pinIconReady = false;

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
    return {
      dateIso: dateIso,
      dateParts: parseDateParts(dateIso),
      placeName: normalizePlaceName(place),
      filledCount: filled,
      recruiting: recruiting,
      recruitText: recruiting + "名募集中",
    };
  }

  function updateRecruitDisplay() {
    document.getElementById("recruitValue").textContent = getFormState().recruitText;
  }

  function scheduleDraw() {
    if (!ready || !bgReady || !fontsReady || !pinIconReady) return;
    if (drawTimer) clearTimeout(drawTimer);
    drawTimer = setTimeout(function () {
      drawTimer = null;
      drawStory();
    }, 80);
  }

  function loadBackgroundImage() {
    bgImage = new Image();
    bgImage.onload = function () {
      bgReady = true;
      if (ready && fontsReady && pinIconReady) drawStory();
    };
    bgImage.onerror = function () {
      bgReady = true;
      if (ready && fontsReady && pinIconReady) drawStory();
    };
    bgImage.src = INVITE_BG_URL;
  }

  function loadPinIcon() {
    pinIcon = new Image();
    pinIcon.onload = function () {
      pinIconReady = true;
      if (ready && bgReady && fontsReady) drawStory();
    };
    pinIcon.onerror = function () {
      pinIconReady = true;
      if (ready && bgReady && fontsReady) drawStory();
    };
    pinIcon.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(PIN_ICON_SVG);
  }

  function loadCanvasFonts() {
    function onFontsDone() {
      fontsReady = true;
      if (ready && bgReady && pinIconReady) drawStory();
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
    ])
      .then(function () {
        return document.fonts.ready;
      })
      .then(onFontsDone)
      .catch(onFontsDone);
  }

  function drawBackgroundCover(ctx2d, img) {
    if (!img || !img.naturalWidth) {
      ctx2d.fillStyle = "#e8ecf0";
      ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(CANVAS_W / iw, CANVAS_H / ih);
    const sw = CANVAS_W / scale;
    const sh = CANVAS_H / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;
    ctx2d.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
  }

  function textShadowOn() {
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 6;
  }

  function textShadowOff() {
    ctx.shadowBlur = 0;
  }

  function measureRecruitWidth(num) {
    const suffix = "名募集中";
    ctx.font = F_RECRUIT_NUM;
    ctx.letterSpacing = ORBITRON_TRACKING;
    const nw = ctx.measureText(String(num)).width;
    ctx.letterSpacing = "0px";
    ctx.font = F_RECRUIT_SUFFIX;
    const sw = ctx.measureText(suffix).width;
    return nw + NUM_SUFFIX_GAP + sw;
  }

  function measureDateWidth(parts) {
    if (!parts) return ctx.measureText("—").width;
    const main = parts.m + "/" + parts.d;
    const day = "(" + parts.weekday + ")";
    ctx.font = F_DATE_MAIN;
    ctx.letterSpacing = ORBITRON_TRACKING;
    const mw = ctx.measureText(main).width;
    ctx.letterSpacing = "0px";
    ctx.font = F_DATE_DAY;
    const dw = ctx.measureText(day).width;
    return mw + 6 * SCALE + dw;
  }

  function measureSpacedText(text, letterEm) {
    ctx.font = F_TIME;
    const chars = String(text).split("");
    let total = 0;
    const em = ctx.measureText("M").width * letterEm;
    for (let i = 0; i < chars.length; i++) {
      total += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) total += em;
    }
    return total;
  }

  function measurePlaceWidth(name) {
    const pin = PLACE_PIN_PX * SCALE;
    const gap = PLACE_PIN_GAP * SCALE;
    ctx.font = F_PLACE;
    if (!name || name === "—") return ctx.measureText("—").width;
    return pin + gap + ctx.measureText(name).width;
  }

  function measureStackHeight() {
    let h = RECRUIT_NUM_PX * SCALE;
    h += GAP_RECRUIT;
    h += 40 * SCALE;
    h += GAP_DATE;
    h += 18 * SCALE;
    h += GAP_TIME;
    h += 30 * SCALE;
    h += GAP_PLACE;
    h += 15 * SCALE * 1.8 * 2;
    return h;
  }

  function drawRecruitLine(cx, y, num) {
    const suffix = "名募集中";
    const numStr = String(num);
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
    ctx.fillStyle = COLOR_MAIN;
    ctx.fillText(suffix, x, y);
    textShadowOff();
  }

  function drawDateLine(cx, y, parts) {
    if (!parts) {
      ctx.font = F_DATE_MAIN;
      ctx.fillStyle = COLOR_MAIN;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      textShadowOn();
      ctx.fillText("—", cx, y);
      textShadowOff();
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
    x += ctx.measureText(main).width + 6 * SCALE;
    ctx.font = F_DATE_DAY;
    ctx.fillText(day, x, y);
    textShadowOff();
  }

  function drawSpacedText(cx, y, text, font, color, letterEm) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const chars = String(text).split("");
    const em = ctx.measureText("M").width * letterEm;
    const totalW = measureSpacedText(text, letterEm);
    let x = cx - totalW / 2;
    textShadowOn();
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, y);
      x += ctx.measureText(chars[i]).width + (i < chars.length - 1 ? em : 0);
    }
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

  function drawPlaceLine(cx, y, name) {
    name = normalizePlaceName(name);
    if (name === "—") {
      drawCenteredText(cx, y, "—", F_PLACE, COLOR_MAIN);
      return;
    }
    const pinSize = PLACE_PIN_PX * SCALE;
    const gap = PLACE_PIN_GAP * SCALE;
    const totalW = measurePlaceWidth(name);
    let x = cx - totalW / 2;

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    textShadowOn();
    if (pinIcon && pinIcon.complete && pinIcon.naturalWidth) {
      ctx.drawImage(pinIcon, x, y - pinSize / 2, pinSize, pinSize);
    }
    x += pinSize + gap;
    ctx.font = F_PLACE;
    ctx.fillStyle = COLOR_MAIN;
    ctx.fillText(name, x, y);
    textShadowOff();
  }

  function drawFooter(cx, y) {
    const lineH = 11 * SCALE * 1.8;
    drawCenteredText(cx, y, GUIDE_LINE1, F_FOOTER, COLOR_MUTED);
    drawCenteredText(cx, y + lineH, GUIDE_LINE2, F_FOOTER, COLOR_MUTED);
  }

  function drawStory() {
    if (!bgReady || !fontsReady || !pinIconReady) return;

    const state = getFormState();
    drawBackgroundCover(ctx, bgImage);

    const cx = CANVAS_W / 2;
    const totalH = measureStackHeight();
    const regionH = CANVAS_H - TEXT_REGION_TOP - TEXT_REGION_PAD_BOTTOM;
    let y = TEXT_REGION_TOP + Math.max(0, (regionH - totalH) / 2);

    y += (RECRUIT_NUM_PX * SCALE) / 2;
    drawRecruitLine(cx, y, state.recruiting);
    y += (RECRUIT_NUM_PX * SCALE) / 2 + GAP_RECRUIT;

    y += (40 * SCALE) / 2;
    drawDateLine(cx, y, state.dateParts);
    y += (40 * SCALE) / 2 + GAP_DATE;

    y += (18 * SCALE) / 2;
    drawSpacedText(cx, y, EVENT_TIME_DISPLAY, F_TIME, COLOR_MUTED, 0.15);
    y += (18 * SCALE) / 2 + GAP_TIME;

    y += (30 * SCALE) / 2;
    drawPlaceLine(cx, y, state.placeName);
    y += (30 * SCALE) / 2 + GAP_PLACE;

    y += (15 * SCALE * 1.8) / 2;
    drawFooter(cx, y);
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
    if (bgReady && fontsReady && pinIconReady) drawStory();
  }

  function showError(msg) {
    document.getElementById("loadingArea").style.display = "none";
    document.getElementById("appContent").classList.add("ready");
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.className = "invite-status error";
    ready = true;
    if (bgReady && fontsReady && pinIconReady) drawStory();
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
  }

  async function loadBootstrap() {
    const fallback = { dateIso: todayIso(), place: DEFAULT_PLACE, filledCount: 0 };
    const apiUrl = gasCalendarApiUrl();
    if (!apiUrl) {
      showError("GAS URL が未設定です。手動で入力して利用できます。");
      applyBootstrap(fallback);
      showReady();
      return;
    }
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || "データの取得に失敗しました。");
      }
      applyBootstrap(bootstrapFromSessions(data.sessions || []));
      showReady();
    } catch (err) {
      showError(formatUserError(err) + " — 手動で入力して利用できます。");
      applyBootstrap(fallback);
      showReady();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadBackgroundImage();
    loadPinIcon();
    loadCanvasFonts();
    bindEvents();
    loadBootstrap();
  });
})();
