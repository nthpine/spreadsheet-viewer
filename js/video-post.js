/**
 * NORTH PINE 動画投稿告知画像（GitHub Pages）
 * 函館夜景背景・中央ロゴ・空ゾーンに投稿日（またはガイド）と YouTube+CTA を縦中央配置。
 */
(function () {
  "use strict";

  const LOGO_URL = "NORTHPINE_背景なし.png";
  const BG_URL = "1_The_night_view_from_Mt_Hakodate-1-14MB.jpg";
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  const FONT_ORBITRON = "Orbitron, sans-serif";
  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';

  const COLOR_BG = "#121a2a";
  const COLOR_TEXT = "#ffffff";
  const COLOR_RED = "#ff1f3d";
  const TEXT_STROKE_COLOR = "rgba(0, 0, 0, 0.75)";
  const TEXT_STROKE_WIDTH = 3;

  const GUIDE_MAIN = "日付を入力してください";
  const GUIDE_SUB = "上のフォームで投稿日を選択";
  const CTA_LINE1 = "プロフィールのリンクから";
  const CTA_LINE2 = "再生リストをご覧ください";
  const DATE_SUFFIX = "の動画を投稿しました！";

  const COLUMN_LEFT = 72;
  const COLUMN_W = CANVAS_W - COLUMN_LEFT * 2;

  const LOGO_MARK_WIDTH_RATIO = 0.45;
  const LOGO_TOP = 190;
  const BG_SOURCE_HEIGHT_RATIO = 0.5;

  const DATE_MD_WEIGHT = 700;
  const DATE_LINE_MAX_SIZE = 96;

  const YT_WIDTH = 200;
  const YT_HEIGHT_RATIO = 0.7;
  const YT_RADIUS_RATIO = 0.3;
  const YT_TRIANGLE_WIDTH_RATIO = 0.24;
  const CTA_FONT_SIZE = 48;
  const CTA_LINE_GAP = 14;
  const YT_TO_CTA_GAP = 36;
  const SKY_ZONE_BOTTOM_RATIO = 0.62;
  const DATE_TO_FOOTER_GAP = 48;
  const SKY_BLOCK_OFFSET_Y = 200;

  const GUIDE_MAIN_SIZE = 60;
  const GUIDE_SUB_SIZE = 46;
  const GUIDE_LINE_GAP = 20;

  const canvas = document.getElementById("exportCanvas");
  const ctx = canvas.getContext("2d");
  const saveImageEl = document.getElementById("saveImage");
  const statusEl = document.getElementById("statusMsg");

  let lastPngDataUrl = "";
  let lastBlob = null;
  let logoCanvas = null;
  let logoBounds = null;
  let logoReady = false;
  let fontsReady = false;
  let bgImage = null;
  let bgReady = false;

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

  function parseDateParts(iso) {
    if (!iso) return null;
    const parts = String(iso).split("-");
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return { y: y, m: m, d: d, weekday: WEEKDAYS[dt.getDay()] };
  }

  function getFormState() {
    const dateIso = document.getElementById("inputDate").value;
    const dateParts = parseDateParts(dateIso);
    return { dateIso: dateIso, dateParts: dateParts };
  }

  function formatDownloadName(dateParts) {
    if (!dateParts) return "video_post.png";
    const y = dateParts.y;
    const m = ("0" + dateParts.m).slice(-2);
    const d = ("0" + dateParts.d).slice(-2);
    return "video_post_" + y + m + d + ".png";
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg || "";
    statusEl.className = "video-post-status" + (type ? " " + type : "");
  }

  function fontOrbitron(sizePx) {
    return DATE_MD_WEIGHT + " " + sizePx + "px " + FONT_ORBITRON;
  }

  function fontJp(sizePx) {
    return "700 " + sizePx + "px " + FONT_JP;
  }

  function measureTextExtents(font, text) {
    ctx.font = font;
    const m = ctx.measureText(text);
    const ascent = m.actualBoundingBoxAscent || m.fontBoundingBoxAscent || 0;
    const descent = m.actualBoundingBoxDescent || m.fontBoundingBoxDescent || 0;
    return {
      width: m.width,
      ascent: ascent,
      descent: descent,
      height: ascent + descent,
    };
  }

  function drawStrokedText(text, x, baselineY, font, align) {
    ctx.font = font;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = TEXT_STROKE_WIDTH;
    ctx.strokeStyle = TEXT_STROKE_COLOR;
    ctx.strokeText(text, x, baselineY);
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(text, x, baselineY);
  }

  // ---- 背景（元画像の上半分を 1080x1920 に cover） ----

  function drawBackgroundCover() {
    if (!bgImage) {
      ctx.fillStyle = COLOR_BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    const srcX = 0;
    const srcY = 0;
    const srcW = bgImage.naturalWidth;
    const srcH = bgImage.naturalHeight * BG_SOURCE_HEIGHT_RATIO;
    const scale = Math.max(CANVAS_W / srcW, CANVAS_H / srcH);
    const sw = CANVAS_W / scale;
    const sh = CANVAS_H / scale;
    const sx = srcX + (srcW - sw) / 2;
    const sy = srcY + (srcH - sh) / 2;
    ctx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H);
  }

  function loadBackgroundImage() {
    const img = new Image();
    img.onload = function () {
      bgImage = img;
      bgReady = true;
      if (logoReady && fontsReady) drawStory();
    };
    img.onerror = function () {
      bgReady = true;
      if (logoReady && fontsReady) drawStory();
    };
    img.src = BG_URL;
  }

  // ---- 投稿日1行（m/d は Orbitron、括弧曜日と接尾は JP） ----

  function buildDateLineSegments(parts) {
    const md = parts.m + "/" + parts.d;
    const weekday = "(" + parts.weekday + ")";
    return { md: md, weekday: weekday, suffix: DATE_SUFFIX };
  }

  function measureDateLineWidth(sizePx, segments) {
    const wMd = measureTextExtents(fontOrbitron(sizePx), segments.md).width;
    const wWd = measureTextExtents(fontJp(sizePx), segments.weekday).width;
    const wSf = measureTextExtents(fontJp(sizePx), segments.suffix).width;
    return wMd + wWd + wSf;
  }

  function fitDateLineSize(segments) {
    let lo = 12;
    let hi = DATE_LINE_MAX_SIZE;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measureDateLineWidth(mid, segments) <= COLUMN_W) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  function measureDateLineExtents(sizePx, segments) {
    const mdExt = measureTextExtents(fontOrbitron(sizePx), segments.md);
    const wdExt = measureTextExtents(fontJp(sizePx), segments.weekday);
    const sfExt = measureTextExtents(fontJp(sizePx), segments.suffix);
    return {
      width: mdExt.width + wdExt.width + sfExt.width,
      ascent: Math.max(mdExt.ascent, wdExt.ascent, sfExt.ascent),
      descent: Math.max(mdExt.descent, wdExt.descent, sfExt.descent),
      mdExt: mdExt,
      wdExt: wdExt,
      sfExt: sfExt,
    };
  }

  function drawDateLineCentered(baselineY, parts) {
    const segments = buildDateLineSegments(parts);
    const sizePx = fitDateLineSize(segments);
    const ext = measureDateLineExtents(sizePx, segments);
    let x = (CANVAS_W - ext.width) / 2;
    drawStrokedText(segments.md, x, baselineY, fontOrbitron(sizePx), "left");
    x += ext.mdExt.width;
    drawStrokedText(segments.weekday, x, baselineY, fontJp(sizePx), "left");
    x += ext.wdExt.width;
    drawStrokedText(segments.suffix, x, baselineY, fontJp(sizePx), "left");
    return ext;
  }

  // ---- ロゴ（透明余白を除き、原画像をそのまま描く） ----

  function buildQuietLogo(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ox = off.getContext("2d");
    ox.drawImage(img, 0, 0);
    const data = ox.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        if (data[(py * w + px) * 4 + 3] > 0) {
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (maxX < 0) {
      return { canvas: off, bounds: { x: 0, y: 0, w: w, h: h } };
    }
    return {
      canvas: off,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    };
  }

  function drawLogoTop() {
    if (!logoCanvas || !logoBounds) {
      return LOGO_TOP + 160;
    }
    const b = logoBounds;
    const drawW = CANVAS_W * LOGO_MARK_WIDTH_RATIO;
    const drawH = (drawW * b.h) / b.w;
    const dx = (CANVAS_W - drawW) / 2;
    ctx.drawImage(logoCanvas, b.x, b.y, b.w, b.h, dx, LOGO_TOP, drawW, drawH);
    return LOGO_TOP + drawH;
  }

  // ---- フッター（YouTube マーク + CTA） ----

  function traceRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawYouTubeMark(left, top, width, height) {
    ctx.fillStyle = COLOR_RED;
    traceRoundRect(left, top, width, height, height * YT_RADIUS_RATIO);
    ctx.fill();

    const triW = width * YT_TRIANGLE_WIDTH_RATIO;
    const triH = triW * 1.15;
    const cx = left + width / 2;
    const cy = top + height / 2;
    const triLeft = cx - triW / 3;
    ctx.fillStyle = COLOR_TEXT;
    ctx.beginPath();
    ctx.moveTo(triLeft, cy - triH / 2);
    ctx.lineTo(triLeft + triW, cy);
    ctx.lineTo(triLeft, cy + triH / 2);
    ctx.closePath();
    ctx.fill();
  }

  function measureFooterRowHeight() {
    const ytH = YT_WIDTH * YT_HEIGHT_RATIO;
    const ctaFont = fontJp(CTA_FONT_SIZE);
    const cta1 = measureTextExtents(ctaFont, CTA_LINE1);
    const cta2 = measureTextExtents(ctaFont, CTA_LINE2);
    const ctaH = cta1.height + CTA_LINE_GAP + cta2.height;
    return Math.max(ytH, ctaH);
  }

  function getFooterLayout(rowTop) {
    const ytH = YT_WIDTH * YT_HEIGHT_RATIO;
    const ctaFont = fontJp(CTA_FONT_SIZE);
    const cta1 = measureTextExtents(ctaFont, CTA_LINE1);
    const cta2 = measureTextExtents(ctaFont, CTA_LINE2);
    const ctaH = cta1.height + CTA_LINE_GAP + cta2.height;
    const ctaW = Math.max(cta1.width, cta2.width);
    const rowH = Math.max(ytH, ctaH);
    const rowW = YT_WIDTH + YT_TO_CTA_GAP + ctaW;
    const rowLeft = (CANVAS_W - rowW) / 2;
    const ytTop = rowTop + (rowH - ytH) / 2;
    const ctaTop = rowTop + (rowH - ctaH) / 2;
    return {
      footerTop: rowTop,
      rowH: rowH,
      ytLeft: rowLeft,
      ytTop: ytTop,
      ytH: ytH,
      ctaX: rowLeft + YT_WIDTH + YT_TO_CTA_GAP,
      ctaFont: ctaFont,
      cta1Baseline: ctaTop + cta1.ascent,
      cta2Baseline: ctaTop + cta1.height + CTA_LINE_GAP + cta2.ascent,
    };
  }

  function drawFooter(layout) {
    drawYouTubeMark(layout.ytLeft, layout.ytTop, YT_WIDTH, layout.ytH);
    drawStrokedText(CTA_LINE1, layout.ctaX, layout.cta1Baseline, layout.ctaFont, "left");
    drawStrokedText(CTA_LINE2, layout.ctaX, layout.cta2Baseline, layout.ctaFont, "left");
  }

  function measureGuideBlockHeight() {
    const mainExt = measureTextExtents(fontJp(GUIDE_MAIN_SIZE), GUIDE_MAIN);
    const subExt = measureTextExtents(fontJp(GUIDE_SUB_SIZE), GUIDE_SUB);
    return mainExt.height + GUIDE_LINE_GAP + subExt.height;
  }

  function drawGuideBlock(blockTop) {
    const mainFont = fontJp(GUIDE_MAIN_SIZE);
    const subFont = fontJp(GUIDE_SUB_SIZE);
    const mainExt = measureTextExtents(mainFont, GUIDE_MAIN);
    const subExt = measureTextExtents(subFont, GUIDE_SUB);
    const mainBaseline = blockTop + mainExt.ascent;
    const subBaseline = mainBaseline + mainExt.descent + GUIDE_LINE_GAP + subExt.ascent;
    drawStrokedText(GUIDE_MAIN, CANVAS_W / 2, mainBaseline, mainFont, "center");
    drawStrokedText(GUIDE_SUB, CANVAS_W / 2, subBaseline, subFont, "center");
  }

  // ---- 本体 ----

  function drawStory() {
    if (!logoReady || !fontsReady || !bgReady) return;

    const state = getFormState();

    drawBackgroundCover();

    const logoBottom = drawLogoTop();
    const skyZoneTop = logoBottom;
    const skyZoneBottom = CANVAS_H * SKY_ZONE_BOTTOM_RATIO;
    const footerRowH = measureFooterRowHeight();

    if (state.dateParts) {
      const segments = buildDateLineSegments(state.dateParts);
      const sizePx = fitDateLineSize(segments);
      const ext = measureDateLineExtents(sizePx, segments);
      const dateH = ext.ascent + ext.descent;
      const totalBlockH = dateH + DATE_TO_FOOTER_GAP + footerRowH;
      const blockTop =
        skyZoneTop + (skyZoneBottom - skyZoneTop - totalBlockH) / 2 + SKY_BLOCK_OFFSET_Y;
      const baselineY = blockTop + ext.ascent;
      drawDateLineCentered(baselineY, state.dateParts);
      const rowTop = blockTop + dateH + DATE_TO_FOOTER_GAP;
      drawFooter(getFooterLayout(rowTop));
    } else {
      const guideH = measureGuideBlockHeight();
      const totalBlockH = guideH + DATE_TO_FOOTER_GAP + footerRowH;
      const blockTop =
        skyZoneTop + (skyZoneBottom - skyZoneTop - totalBlockH) / 2 + SKY_BLOCK_OFFSET_Y;
      drawGuideBlock(blockTop);
      const rowTop = blockTop + guideH + DATE_TO_FOOTER_GAP;
      drawFooter(getFooterLayout(rowTop));
    }
    syncSaveImageFromCanvas();
  }

  function syncSaveImageFromCanvas() {
    try {
      lastPngDataUrl = canvas.toDataURL("image/png");
      saveImageEl.src = lastPngDataUrl;
      canvas.toBlob(function (blob) {
        lastBlob = blob;
      }, "image/png");
    } catch (e) {
      lastPngDataUrl = "";
      lastBlob = null;
    }
  }

  function loadLogoImage() {
    const img = new Image();
    img.onload = function () {
      const quiet = buildQuietLogo(img);
      logoCanvas = quiet.canvas;
      logoBounds = quiet.bounds;
      logoReady = true;
      if (fontsReady && bgReady) drawStory();
    };
    img.onerror = function () {
      logoReady = true;
      if (fontsReady && bgReady) drawStory();
    };
    img.src = LOGO_URL;
  }

  function loadCanvasFonts() {
    function onFontsDone() {
      fontsReady = true;
      if (logoReady && bgReady) drawStory();
    }

    if (!document.fonts || !document.fonts.load) {
      onFontsDone();
      return;
    }

    Promise.all([
      document.fonts.load(fontOrbitron(DATE_LINE_MAX_SIZE), "0123456789/"),
      document.fonts.load(fontJp(CTA_FONT_SIZE), CTA_LINE1 + CTA_LINE2),
      document.fonts.load(fontJp(GUIDE_MAIN_SIZE), GUIDE_MAIN + GUIDE_SUB + DATE_SUFFIX),
      document.fonts.load(fontJp(DATE_LINE_MAX_SIZE), "()" + WEEKDAYS.join("") + DATE_SUFFIX),
    ])
      .then(function () {
        return document.fonts.ready;
      })
      .then(onFontsDone)
      .catch(onFontsDone);
  }

  function downloadPng() {
    const state = getFormState();
    if (!lastPngDataUrl) {
      setStatus("画像の生成に失敗しました。", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = lastPngDataUrl;
    a.download = formatDownloadName(state.dateParts);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStatus("ダウンロードを開始しました。", "success");
  }

  function openInNewTab() {
    if (!lastPngDataUrl) {
      setStatus("画像の生成に失敗しました。", "error");
      return;
    }
    const w = window.open();
    if (!w) {
      setStatus("ポップアップがブロックされました。ブラウザの設定を確認してください。", "error");
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html><head><title>動画投稿告知</title></head><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh">' +
        '<img src="' +
        lastPngDataUrl +
        '" alt="動画投稿告知" style="max-width:100%;height:auto" /></body></html>',
    );
    w.document.close();
    setStatus("新規タブで画像を開きました。", "success");
  }

  function supportsClipboardImage() {
    return (
      typeof ClipboardItem !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function"
    );
  }

  async function copyToClipboard() {
    if (!supportsClipboardImage()) {
      setStatus("このブラウザは画像のクリップボードコピーに対応していません。", "error");
      return;
    }
    if (!lastBlob) {
      setStatus("画像の生成に失敗しました。", "error");
      return;
    }
    try {
      const item = new ClipboardItem({ "image/png": lastBlob });
      await navigator.clipboard.write([item]);
      setStatus("クリップボードにコピーしました。", "success");
    } catch (e) {
      setStatus("クリップボードへのコピーに失敗しました。", "error");
    }
  }

  function bindEvents() {
    const dateEl = document.getElementById("inputDate");
    dateEl.addEventListener("input", drawStory);
    dateEl.addEventListener("change", drawStory);

    document.getElementById("btnDownload").addEventListener("click", downloadPng);
    document.getElementById("btnOpenTab").addEventListener("click", openInNewTab);
    document.getElementById("btnCopy").addEventListener("click", copyToClipboard);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("inputDate").value = todayIso();
    loadBackgroundImage();
    loadLogoImage();
    loadCanvasFonts();
    bindEvents();
  });
})();
