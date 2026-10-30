/**
 * NORTH PINE 募集画像モック（複数日程プレビュー）
 */
(function () {
  "use strict";

  const MAX_SLOTS = 15;
  const LOGO_URL = "NORTHPINE_背景なし.png";

  const GUIDE_ACTION_HEADLINE_TEXT = "参加希望の方は";
  const GUIDE_ACTION_LINE2_TEXT = "DMに日付を入れて送ってください！";
  const GUIDE_FIRST_BOX_TITLE = "初参加の方は";
  const GUIDE_FIRST_BOX_BODY = "名前・性別・バスケ歴も添えてください";
  const GUIDE_FIRST_BOX_HINT = "（バスケ歴は大体でOK）";

  const GUIDE_ACTION_PX = 15;
  const GUIDE_FIRST_BOX_TITLE_PX = 14;
  const GUIDE_FIRST_BOX_BODY_PX = 13;
  const GUIDE_FIRST_BOX_HINT_PX = 11;

  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const SCALE = 3;

  const FONT_ORBITRON = "Orbitron, sans-serif";
  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';

  const RECRUIT_NUM_PX = 72;
  const RECRUIT_SUFFIX_PX = 48;

  const COLOR_MAIN = "#ffffff";
  const COLOR_ACCENT = "#b9ddf4";
  const COLOR_MUTED = "#b0bac6";

  const BG_TOP = "#111827";
  const BG_MID = "#1c2330";
  const BG_BOTTOM = "#242b35";
  const BG_MARGIN = "#3a4554";

  const NOTE_BOX_PAD_X = 12 * SCALE;
  const NOTE_BOX_PAD_Y = 8 * SCALE;
  const NOTE_BOX_RADIUS = 8 * SCALE;
  const NOTE_BOX_STROKE = 2 * SCALE;

  const GUIDE_BOX_WIDTH_MIN = CANVAS_W - 200;
  const GUIDE_BOX_PAD_Y = 18 * SCALE;
  const GUIDE_PAD_X = 24 * SCALE;
  const GUIDE_GAP_ACTION_HEAD_TO_DM = 6 * SCALE;
  const GUIDE_GAP_ACTION_TO_FIRST_BOX = 12 * SCALE;
  const GUIDE_FIRST_BOX_PAD_X = 16 * SCALE;
  const GUIDE_FIRST_BOX_PAD_Y = 10 * SCALE;
  const GUIDE_FIRST_BOX_LINE_GAP = 4 * SCALE;
  const GUIDE_FIRST_BOX_BAND_INSET_X = 24 * SCALE;
  const GUIDE_BACKGROUND = "rgba(9, 20, 37, 0.48)";

  const MIN_TOP_PAD = 72;
  const FOOTER_FIRST_LINE_Y_DEFAULT = CANVAS_H - 230;

  const F_RECRUIT_NUM = "900 " + RECRUIT_NUM_PX * SCALE + "px " + FONT_ORBITRON;
  const F_RECRUIT_SUFFIX = "900 " + RECRUIT_SUFFIX_PX * SCALE + "px " + FONT_JP;
  const F_DATE_MAIN = "700 " + 36 * SCALE + "px " + FONT_ORBITRON;
  const F_DATE_DAY = "500 " + 20 * SCALE + "px " + FONT_JP;
  const F_TIME = "500 " + 20 * SCALE + "px " + FONT_ORBITRON;
  const F_PLACE = "700 " + 28 * SCALE + "px " + FONT_JP;
  const F_GUIDE_ACTION = "700 " + GUIDE_ACTION_PX * SCALE + "px " + FONT_JP;
  const F_GUIDE_FIRST_BOX_TITLE =
    "700 " + GUIDE_FIRST_BOX_TITLE_PX * SCALE + "px " + FONT_JP;
  const F_GUIDE_FIRST_BOX_BODY =
    "500 " + GUIDE_FIRST_BOX_BODY_PX * SCALE + "px " + FONT_JP;
  const F_GUIDE_FIRST_BOX_HINT =
    "500 " + GUIDE_FIRST_BOX_HINT_PX * SCALE + "px " + FONT_JP;

  const FOOTER_LINE_H = 14 * SCALE * 1.6;
  const GUIDE_LINE_H_ACTION = GUIDE_ACTION_PX * SCALE * 1.35;
  const GUIDE_FIRST_BOX_LINE_H1 = GUIDE_FIRST_BOX_TITLE_PX * SCALE * 1.35;
  const GUIDE_FIRST_BOX_LINE_H2 = GUIDE_FIRST_BOX_BODY_PX * SCALE * 1.35;
  const GUIDE_FIRST_BOX_LINE_H3 = GUIDE_FIRST_BOX_HINT_PX * SCALE * 1.35;
  const GUIDE_BOTTOM_FROM_FIRST_LINE_Y = 1.5 * FOOTER_LINE_H + GUIDE_BOX_PAD_Y;

  const GAP_DATE = 16 * SCALE;
  const GAP_TIME = 28 * SCALE;
  const GAP_RECRUIT = 40 * SCALE;

  const NUM_SUFFIX_GAP = 4 * SCALE;
  const ORBITRON_TRACKING = "-0.02em";

  const SLOT_DIVIDER_MARGIN = 80;
  const SLOT_DIVIDER_COLOR = "rgba(255,255,255,0.15)";
  const SLOT_DIVIDER_WIDTH = 2;

  const LOGO_WATERMARK_MAX_RATIO = 0.88;
  const LOGO_WATERMARK_ALPHA = 0.12;

  const F_SAMPLE = "700 " + 14 * SCALE + "px " + FONT_ORBITRON;
  const SAMPLE_PAD_X = 24 * SCALE;
  const SAMPLE_PAD_Y = 20 * SCALE;


  const SPREADSHEET_ID = "1-07mnQUToyJjD2pNau99a0dCLmg_0chswzvv3eW4t30";
  const RECORD_SHEET_NAME = "record";
  const MAX_TEAM_SLOTS = 3;
  const MAX_SHOW = 3;
  const DEFAULT_PLACE = "中央体育館";
  const EVENT_TIME_DISPLAY = "19:15 - 21:45";
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  let loadError = "";
  let loadedSessions = null;
  let totalUpcoming = 0;

  function csvUrl(sheetName) {
    const q = new URLSearchParams({ tqx: "out:csv", sheet: sheetName });
    return "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/gviz/tq?" + q;
  }
  function csvLooksValid(t) {
    t = String(t || "").replace(/^\uFEFF/, "").trimStart();
    if (!t || t.startsWith("<") || t.length < 2) return false;
    return t.includes(",") || t.includes("\t");
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", i = 0, q = false;
    while (i < text.length) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; } cell += c; i++; continue; }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(cell); cell = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
      cell += c; i++;
    }
    row.push(cell); if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }
  function looksLikeHeader(rows) {
    if (!rows || rows.length < 2) return false;
    const a0 = String(rows[0][0] || "").trim(), b0 = String(rows[0][1] || "").trim();
    return b0.includes("日付") || a0.includes("連番");
  }
  function normDisp(s) {
    return String(s == null ? "" : s).replace(/\u200b|\u200c|\u200d|\ufeff/g, "").replace(/\u00a0|\u3000/g, " ").replace(/\s+/g, " ").trim();
  }
  function pad2(n) { return ("0" + n).slice(-2); }
  function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function parseRecordDate(v) {
    const label = String(v == null ? "" : v).trim();
    if (!label) return null;
    const full = label.match(/^(\d{4})[\/\.\-年](\d{1,2})[\/\.\-月](\d{1,2})/);
    if (full) return new Date(+full[1], +full[2] - 1, +full[3]);
    const t = label.replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").trim();
    const m = t.match(/(\d{1,2})月(\d{1,2})日/) || t.match(/(\d{1,2})[\/．\.](\d{1,2})/);
    if (!m) return null;
    const now = new Date();
    let d = new Date(now.getFullYear(), +m[1] - 1, +m[2]);
    // 年なし表記の年またぎ対策（本番は常に今年扱い）: 60日以上過去なら翌年とみなす
    if ((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - d) / 86400000 > 60) d = new Date(now.getFullYear() + 1, +m[1] - 1, +m[2]);
    if (d.getMonth() !== +m[1] - 1 || d.getDate() !== +m[2]) return null;
    return d;
  }
  async function loadSessions() {
    const res = await fetch(csvUrl(RECORD_SHEET_NAME));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (!csvLooksValid(text)) throw new Error("CSV invalid");
    let rows = parseCSV(text);
    if (looksLikeHeader(rows)) rows = rows.slice(1);
    const groups = {};
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 2) { console.error("[invite] skip broken row", row); continue; }
      const dateRaw = String(row[1] || "").trim(); if (!dateRaw) continue;
      const place = String(row[2] || "").trim() || "—";
      const key = dateRaw + "\t" + place;
      const g = groups[key] || (groups[key] = { dateRaw: dateRaw, place: place, bySeq: {}, note: "" });
      const seq = parseInt(String(row[0] || "").trim(), 10);
      if (seq === 1) g.note = String(row[7] || "").trim();
      if (Number.isFinite(seq) && seq >= 1 && seq <= MAX_SLOTS) g.bySeq[seq - 1] = normDisp(row[3]);
    }
    const today = isoOf(new Date());
    const out = [];
    for (const k of Object.keys(groups)) {
      try {
      const g = groups[k]; const d = parseRecordDate(g.dateRaw);
      if (!d || isNaN(d.getTime())) { console.error("[invite] skip unreadable date", g.dateRaw); continue; }
      let team = true; for (let i = 3; i < MAX_SLOTS; i++) if (g.bySeq[i] !== undefined) team = false;
      let limit = MAX_SLOTS;
      if (team) { limit = 0; for (let i = 0; i < MAX_TEAM_SLOTS; i++) if (g.bySeq[i] !== undefined) limit = i + 1; limit = limit || 1; }
      let filled = 0; for (let i = 0; i < limit; i++) if (g.bySeq[i]) filled++;
      const iso = isoOf(d);
      if (iso < today) continue;
      const recruiting = Math.max(0, MAX_SLOTS - Math.min(MAX_SLOTS, filled));
      out.push({ dateIso: iso, m: d.getMonth() + 1, d: d.getDate(), weekday: WEEKDAYS[d.getDay()], time: EVENT_TIME_DISPLAY,
        place: g.place !== "—" ? normalizePlaceName(g.place) : DEFAULT_PLACE, recruiting: recruiting, note: g.note });
      } catch (e) { console.error("[invite] skip session", k, e); }
    }
    out.sort(function (a, b) { return a.dateIso < b.dateIso ? -1 : a.dateIso > b.dateIso ? 1 : 0; });
    totalUpcoming = out.length;
    // 満員(募集0名)は複数表示では除外
    return out.filter(function (s) { return s.recruiting > 0; });
  }

  const canvas = document.getElementById("exportCanvas");
  const ctx = canvas.getContext("2d");

  let logoImage = null;
  let logoLoaded = false;
  let logoFailed = false;
  let fontsReady = false;
  let drawStarted = false;

  function getDisplayCount() {
    const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const n = parseInt(String(params.get("n") || ""), 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(n, MAX_SHOW);
    return MAX_SHOW;
  }

  function normalizePlaceName(place) {
    const p = String(place || "").trim();
    if (!p || p === "—") return "—";
    return p.replace(/^[@＠]+/, "").trim() || "—";
  }

  function scaledFont(fontStr, scale) {
    if (scale >= 0.999) return fontStr;
    return fontStr.replace(/(\d+(?:\.\d+)?)px/g, function (_, px) {
      return Math.round(parseFloat(px, 10) * scale) + "px";
    });
  }

  function scaledGap(gap, scale) {
    return gap * scale;
  }

  function measureSessionStackHeight(scale) {
    scale = scale == null ? 1 : scale;
    const dateH = 36 * SCALE * scale;
    const timeH = 20 * SCALE * scale;
    const placeH = 28 * SCALE * scale;
    const recruitH = RECRUIT_NUM_PX * SCALE * scale;
    return (
      dateH +
      scaledGap(GAP_DATE, scale) +
      timeH +
      scaledGap(GAP_TIME, scale) +
      placeH +
      scaledGap(GAP_RECRUIT, scale) +
      recruitH
    );
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

  function drawLogoWatermark() {
    if (logoFailed || !logoImage || !logoImage.naturalWidth) return;
    const maxW = CANVAS_W * LOGO_WATERMARK_MAX_RATIO;
    const maxH = CANVAS_H * LOGO_WATERMARK_MAX_RATIO;
    const iw = logoImage.naturalWidth;
    const ih = logoImage.naturalHeight;
    const fitScale = Math.min(maxW / iw, maxH / ih);
    const w = iw * fitScale;
    const h = ih * fitScale;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.save();
    ctx.globalAlpha = LOGO_WATERMARK_ALPHA;
    ctx.drawImage(logoImage, x, y, w, h);
    ctx.restore();
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

  function measureRecruitWidthAtScale(num, scale) {
    const fNum = scaledFont(F_RECRUIT_NUM, scale);
    const fSuffix = scaledFont(F_RECRUIT_SUFFIX, scale);
    const numStr = String(num);
    const mei = "名";
    const suffix = "募集中";
    ctx.font = fNum;
    ctx.letterSpacing = ORBITRON_TRACKING;
    const nw = ctx.measureText(numStr).width;
    ctx.letterSpacing = "0px";
    ctx.font = fSuffix;
    const mw = ctx.measureText(mei).width;
    const sw = ctx.measureText(suffix).width;
    const gap = scale >= 0.999 ? NUM_SUFFIX_GAP : NUM_SUFFIX_GAP * scale;
    return nw + gap + mw + sw;
  }

  function measureDateWidth(parts, scale) {
    scale = scale == null ? 1 : scale;
    if (!parts) {
      ctx.font = scaledFont(F_DATE_MAIN, scale);
      return ctx.measureText("—").width;
    }
    const main = parts.m + "/" + parts.d;
    const day = "(" + parts.weekday + ")";
    ctx.font = scaledFont(F_DATE_MAIN, scale);
    ctx.letterSpacing = ORBITRON_TRACKING;
    const mw = ctx.measureText(main).width;
    ctx.letterSpacing = "0px";
    ctx.font = scaledFont(F_DATE_DAY, scale);
    const dw = ctx.measureText(day).width;
    return mw + 8 * SCALE * scale + dw;
  }

  function drawDateLine(cx, y, parts, scale) {
    scale = scale == null ? 1 : scale;
    const fMain = scaledFont(F_DATE_MAIN, scale);
    const fDay = scaledFont(F_DATE_DAY, scale);
    if (!parts) {
      drawCenteredText(cx, y, "—", fMain, COLOR_MAIN);
      return;
    }
    const main = parts.m + "/" + parts.d;
    const day = "(" + parts.weekday + ")";
    const totalW = measureDateWidth(parts, scale);
    let x = cx - totalW / 2;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    textShadowOn();
    ctx.font = fMain;
    ctx.fillStyle = COLOR_MAIN;
    ctx.letterSpacing = ORBITRON_TRACKING;
    ctx.fillText(main, x, y);
    ctx.letterSpacing = "0px";
    x += ctx.measureText(main).width + 8 * SCALE * scale;
    ctx.font = fDay;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(day, x, y);
    textShadowOff();
  }

  function drawRecruitLine(cx, y, num, scale) {
    scale = scale == null ? 1 : scale;
    const fNum = scaledFont(F_RECRUIT_NUM, scale);
    const fSuffix = scaledFont(F_RECRUIT_SUFFIX, scale);
    const numStr = String(num);
    const mei = "名";
    const suffix = "募集中";
    const totalW = measureRecruitWidthAtScale(num, scale);
    let x = cx - totalW / 2;
    const gap = scale >= 0.999 ? NUM_SUFFIX_GAP : NUM_SUFFIX_GAP * scale;

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    textShadowOn();

    ctx.font = fNum;
    ctx.fillStyle = COLOR_ACCENT;
    ctx.letterSpacing = ORBITRON_TRACKING;
    ctx.fillText(numStr, x, y);
    ctx.letterSpacing = "0px";
    x += ctx.measureText(numStr).width + gap;

    ctx.font = fSuffix;
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

  function measureGuideActionWidth() {
    ctx.font = F_GUIDE_ACTION;
    const line1W = ctx.measureText(GUIDE_ACTION_HEADLINE_TEXT).width;
    const line2W = ctx.measureText(GUIDE_ACTION_LINE2_TEXT).width;
    return Math.max(line1W, line2W);
  }

  function measureGuideFirstBoxContentWidth() {
    ctx.font = F_GUIDE_FIRST_BOX_TITLE;
    let w = ctx.measureText(GUIDE_FIRST_BOX_TITLE).width;
    ctx.font = F_GUIDE_FIRST_BOX_BODY;
    w = Math.max(w, ctx.measureText(GUIDE_FIRST_BOX_BODY).width);
    ctx.font = F_GUIDE_FIRST_BOX_HINT;
    w = Math.max(w, ctx.measureText(GUIDE_FIRST_BOX_HINT).width);
    return w;
  }

  function measureGuideFirstBoxOuterWidth(bandWidth) {
    const contentW = measureGuideFirstBoxContentWidth();
    let outerW = contentW + GUIDE_FIRST_BOX_PAD_X * 2;
    const maxOuter = bandWidth - GUIDE_FIRST_BOX_BAND_INSET_X * 2;
    return Math.min(outerW, maxOuter);
  }

  function measureGuideFirstBoxHeight() {
    return (
      GUIDE_FIRST_BOX_PAD_Y * 2 +
      GUIDE_FIRST_BOX_LINE_H1 +
      GUIDE_FIRST_BOX_LINE_GAP +
      GUIDE_FIRST_BOX_LINE_H2 +
      GUIDE_FIRST_BOX_LINE_GAP +
      GUIDE_FIRST_BOX_LINE_H3
    );
  }

  function measureGuideBoxWidth() {
    const actionW = measureGuideActionWidth();
    const firstBoxW = measureGuideFirstBoxContentWidth() + GUIDE_FIRST_BOX_PAD_X * 2;
    const textWidth = Math.max(actionW, firstBoxW);
    let width = Math.max(
      GUIDE_BOX_WIDTH_MIN,
      textWidth + GUIDE_PAD_X * 2,
      firstBoxW + GUIDE_FIRST_BOX_BAND_INSET_X * 2
    );
    const maxWidth = CANVAS_W - 80;
    width = Math.min(width, maxWidth);
    return width;
  }

  function buildGuideFirstBoxLayout(bandX, bandWidth, bandInnerBottom) {
    const boxH = measureGuideFirstBoxHeight();
    const boxW = measureGuideFirstBoxOuterWidth(bandWidth);
    const boxX = bandX + (bandWidth - boxW) / 2;
    const boxY = bandInnerBottom - boxH;
    let lineY = boxY + GUIDE_FIRST_BOX_PAD_Y + GUIDE_FIRST_BOX_LINE_H1 / 2;
    const titleY = lineY;
    lineY +=
      GUIDE_FIRST_BOX_LINE_H1 / 2 +
      GUIDE_FIRST_BOX_LINE_GAP +
      GUIDE_FIRST_BOX_LINE_H2 / 2;
    const bodyY = lineY;
    lineY +=
      GUIDE_FIRST_BOX_LINE_H2 / 2 +
      GUIDE_FIRST_BOX_LINE_GAP +
      GUIDE_FIRST_BOX_LINE_H3 / 2;
    const hintY = lineY;
    return {
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      titleY: titleY,
      bodyY: bodyY,
      hintY: hintY,
    };
  }

  function getGuideLineYs(anchorFirstLineY) {
    const firstBoxH = measureGuideFirstBoxHeight();
    const targetBottom = anchorFirstLineY + GUIDE_BOTTOM_FROM_FIRST_LINE_Y;
    let headlineY = anchorFirstLineY;
    let dmLineY =
      headlineY +
      GUIDE_LINE_H_ACTION / 2 +
      GUIDE_GAP_ACTION_HEAD_TO_DM +
      GUIDE_LINE_H_ACTION / 2;
    let bottom =
      dmLineY +
      GUIDE_LINE_H_ACTION / 2 +
      GUIDE_GAP_ACTION_TO_FIRST_BOX +
      firstBoxH +
      GUIDE_BOX_PAD_Y;
    if (bottom > targetBottom) {
      const shift = bottom - targetBottom;
      headlineY -= shift;
      dmLineY -= shift;
      bottom = targetBottom;
    }
    const top = headlineY - GUIDE_LINE_H_ACTION / 2 - GUIDE_BOX_PAD_Y;
    const bandWidth = measureGuideBoxWidth();
    const bandX = (CANVAS_W - bandWidth) / 2;
    const innerBottom = bottom - GUIDE_BOX_PAD_Y;
    const firstBox = buildGuideFirstBoxLayout(bandX, bandWidth, innerBottom);
    return {
      headlineY: headlineY,
      dmLineY: dmLineY,
      top: top,
      bottom: bottom,
      height: bottom - top,
      bandWidth: bandWidth,
      bandX: bandX,
      firstBox: firstBox,
    };
  }

  function getGuideBox(firstLineY) {
    const lines = getGuideLineYs(firstLineY);
    return {
      x: lines.bandX,
      y: lines.top,
      width: lines.bandWidth,
      height: lines.height,
      headlineY: lines.headlineY,
      dmLineY: lines.dmLineY,
      firstBox: lines.firstBox,
    };
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

  function drawGuideActionBlock(cx, headlineY, dmLineY) {
    drawCenteredText(cx, headlineY, GUIDE_ACTION_HEADLINE_TEXT, F_GUIDE_ACTION, COLOR_MAIN);
    drawCenteredText(cx, dmLineY, GUIDE_ACTION_LINE2_TEXT, F_GUIDE_ACTION, COLOR_MAIN);
  }

  function drawGuideFirstBox(firstBox) {
    if (!firstBox) return;
    ctx.save();
    ctx.strokeStyle = COLOR_ACCENT;
    ctx.lineWidth = NOTE_BOX_STROKE;
    ctx.globalAlpha = 0.9;
    roundedRectPath(firstBox.x, firstBox.y, firstBox.width, firstBox.height, NOTE_BOX_RADIUS);
    ctx.stroke();
    ctx.restore();
    const cx = firstBox.x + firstBox.width / 2;
    drawCenteredText(cx, firstBox.titleY, GUIDE_FIRST_BOX_TITLE, F_GUIDE_FIRST_BOX_TITLE, COLOR_ACCENT);
    drawCenteredText(cx, firstBox.bodyY, GUIDE_FIRST_BOX_BODY, F_GUIDE_FIRST_BOX_BODY, COLOR_MAIN);
    drawCenteredText(cx, firstBox.hintY, GUIDE_FIRST_BOX_HINT, F_GUIDE_FIRST_BOX_HINT, COLOR_MUTED);
  }

  function drawFooter(cx, anchorFirstLineY, guideBox) {
    const box = guideBox || getGuideBox(anchorFirstLineY);
    if (box) {
      ctx.save();
      ctx.fillStyle = GUIDE_BACKGROUND;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      ctx.restore();
    }
    drawGuideActionBlock(cx, box.headlineY, box.dmLineY);
    drawGuideFirstBox(box.firstBox);
  }

  const F_NOTE = "500 " + 14 * SCALE + "px " + FONT_JP;

  function drawDividerLine(x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = SLOT_DIVIDER_COLOR;
    ctx.lineWidth = SLOT_DIVIDER_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function fitScale(widthAt1, maxW) {
    return widthAt1 > maxW ? maxW / widthAt1 : 1;
  }

  // 順: 日付 → 募集人数 → 時間 → 場所 → 備考ボックス
  function drawSessionSlot(cx, slotTop, slotW, slotH, session, baseScale) {
    const pad = 40;
    const maxW = slotW - pad * 2;
    const s = baseScale;
    const recruitH = RECRUIT_NUM_PX * SCALE * s;
    const dateH = 36 * SCALE * s;
    const timeH = 20 * SCALE * s;
    const placeH = 28 * SCALE * s;
    const noteH = 14 * SCALE * s;
    const notePadY = NOTE_BOX_PAD_Y * s;
    const noteBoxH = noteH * 1.55 + notePadY * 2;
    const g1 = 14 * SCALE * s, g2 = 16 * SCALE * s, g3 = 10 * SCALE * s, g4 = 18 * SCALE * s;
    const totalH = dateH + g1 + recruitH + g2 + timeH + g3 + placeH + g4 + noteBoxH;
    let y = slotTop + (slotH - totalH) / 2;

    // 日付 → 人数
    y += dateH / 2;
    drawDateLine(cx, y, session, s);
    y += dateH / 2 + g1 + recruitH / 2;
    const rScale = Math.min(s, s * maxW / measureRecruitWidthAtScale(session.recruiting, s));
    drawRecruitLine(cx, y, session.recruiting, rScale);
    y += recruitH / 2 + g2 + timeH / 2;
    drawCenteredText(cx, y, session.time, scaledFont(F_TIME, s), COLOR_MAIN);
    y += timeH / 2 + g3 + placeH / 2;
    ctx.font = scaledFont(F_PLACE, s);
    const pw = ctx.measureText(normalizePlaceName(session.place)).width;
    const ps = Math.min(s, s * maxW / pw);
    drawCenteredText(cx, y, normalizePlaceName(session.place), scaledFont(F_PLACE, ps), COLOR_MAIN);
    y += placeH / 2 + g4;

    if (session.note) {
      let nScale = s;
      ctx.font = scaledFont(F_NOTE, nScale);
      let tw = ctx.measureText(session.note).width;
      const padX = NOTE_BOX_PAD_X * s;
      if (tw + padX * 2 > maxW) {
        nScale = s * (maxW - padX * 2) / tw;
        ctx.font = scaledFont(F_NOTE, nScale);
        tw = ctx.measureText(session.note).width;
      }
      const bw = tw + padX * 2;
      ctx.save();
      ctx.strokeStyle = COLOR_ACCENT;
      ctx.lineWidth = Math.max(3, NOTE_BOX_STROKE * s);
      ctx.globalAlpha = 0.9;
      roundedRectPath(cx - bw / 2, y, bw, noteBoxH, NOTE_BOX_RADIUS * s);
      ctx.stroke();
      ctx.restore();
      drawCenteredText(cx, y + noteBoxH / 2, session.note, scaledFont(F_NOTE, nScale), COLOR_MAIN);
    }
  }

  // 田の字レイアウト: 1=全面 / 2=横並び / 3=品(上が最新) / 4=2x2(左上が最新)
  function getCells(n, top, h) {
    const W = CANVAS_W, hw = W / 2, hh = h / 2;
    if (n === 1) return [{ x: 0, y: top, w: W, h: h }];
    if (n === 2) return [{ x: 0, y: top, w: hw, h: h }, { x: hw, y: top, w: hw, h: h }];
    if (n === 3)
      return [
        { x: 0, y: top, w: W, h: h * 0.58 },
        { x: 0, y: top + h * 0.58, w: hw, h: h * 0.42 },
        { x: hw, y: top + h * 0.58, w: hw, h: h * 0.42 },
      ];
    return [
      { x: 0, y: top, w: hw, h: hh },
      { x: hw, y: top, w: hw, h: hh },
      { x: 0, y: top + hh, w: hw, h: hh },
      { x: hw, y: top + hh, w: hw, h: hh },
    ];
  }

  function drawScheduleArea(sessions, guideBox) {
    const top = MIN_TOP_PAD + 60;
    const bottom = guideBox.y - 20;
    const h = bottom - top;
    const n = sessions.length;
    if (n <= 0 || h <= 0) return;
    const cells = getCells(n, top, h);
    const base = n === 1 ? 1 : n === 2 ? 0.62 : 0.5;
    const m = 40;
    if (n === 2) drawDividerLine(CANVAS_W / 2, top + m, CANVAS_W / 2, bottom - m);
    if (n >= 3) {
      drawDividerLine(m, top + h * 0.58, CANVAS_W - m, top + h * 0.58);
      drawDividerLine(CANVAS_W / 2, top + h * 0.58 + m, CANVAS_W / 2, bottom - m);
    }
    for (let i = 0; i < n; i++) {
      const c = cells[i];
      const scale = n === 3 ? (i === 0 ? 0.92 : 0.42) : base;
      drawSessionSlot(c.x + c.w / 2, c.y, c.w, c.h, sessions[i], scale);
    }
  }

  const F_BOT_POST = "500 " + 11 * SCALE + "px " + FONT_JP;
  function drawBotPostLabel() {
    drawCenteredText(CANVAS_W / 2 + 140, MIN_TOP_PAD, "Bot\u306b\u3088\u308b\u81ea\u52d5\u6295\u7a3f", F_BOT_POST, "#d1d9e0");
  }

  function drawSampleLabel() {
    ctx.save();
    ctx.font = F_SAMPLE;
    ctx.fillStyle = COLOR_MUTED;
    ctx.globalAlpha = 0.5;
    ctx.font = "700 " + 8 * SCALE + "px " + FONT_ORBITRON;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    textShadowOn();
    ctx.fillText("SAMPLE", SAMPLE_PAD_X, SAMPLE_PAD_Y);
    textShadowOff();
    ctx.restore();
  }

  function drawStatusLabel(msg) {
    drawCenteredText(CANVAS_W / 2, CANVAS_H * 0.4, msg, "700 " + 20 * SCALE + "px " + FONT_JP, "#ff9a9a");
  }

  function drawStory() {
    if (!fontsReady || drawStarted) return;
    drawStarted = true;

    const count = getDisplayCount();
    const sessions = (loadedSessions || []).slice(0, count);
    const footerFirstLineY = FOOTER_FIRST_LINE_Y_DEFAULT;
    const guideBox = getGuideBox(footerFirstLineY);
    const cx = CANVAS_W / 2;

    drawGradientBackground(ctx);
    drawLogoWatermark();
    drawScheduleArea(sessions, guideBox);
    drawFooter(cx, footerFirstLineY, guideBox);
    drawBotPostLabel();
    if (loadError) console.error("[invite] load failed:", loadError);
    document.body.setAttribute("data-count", String(sessions.length));
    document.body.setAttribute("data-total", String(totalUpcoming));

    try {
      const img = document.getElementById("saveImage");
      if (img) img.src = canvas.toDataURL("image/png");
    } catch (e) {
      console.error("[invite] export failed", e);
    }
    const loadingEl = document.getElementById("loadingArea");
    if (loadingEl) loadingEl.style.display = "none";
    const app = document.getElementById("appContent");
    if (app) app.classList.add("ready");
    document.body.setAttribute("data-ready", "1");
  }

  function tryDraw() {
    if (fontsReady && logoLoaded && loadedSessions !== null) {
      drawStory();
    }
  }

  function loadLogoImage() {
    logoImage = new Image();
    logoImage.onload = function () {
      logoFailed = false;
      logoLoaded = true;
      tryDraw();
    };
    logoImage.onerror = function () {
      logoFailed = true;
      logoLoaded = true;
      tryDraw();
    };
    logoImage.src = LOGO_URL;
  }

  function loadCanvasFonts() {
    function onFontsDone() {
      fontsReady = true;
      tryDraw();
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
      document.fonts.load(F_GUIDE_ACTION),
      document.fonts.load(F_GUIDE_FIRST_BOX_TITLE),
      document.fonts.load(F_GUIDE_FIRST_BOX_BODY),
      document.fonts.load(F_GUIDE_FIRST_BOX_HINT),
      document.fonts.load(F_SAMPLE),
      document.fonts.load(F_BOT_POST),
    ])
      .then(function () {
        return document.fonts.ready;
      })
      .then(onFontsDone)
      .catch(onFontsDone);
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadLogoImage();
    loadCanvasFonts();
    loadSessions().then(function (r) { loadedSessions = r; tryDraw(); })
      .catch(function (e) { loadError = String((e && e.message) || e); loadedSessions = []; tryDraw(); });
  });
})();
