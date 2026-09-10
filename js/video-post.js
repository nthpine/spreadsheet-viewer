/**
 * NORTH PINE 動画投稿告知画像（GitHub Pages）
 */
(function () {
  "use strict";

  const BACKGROUND_URL = "video-post-background-minimal.png";
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;

  const FONT_ORBITRON = "Orbitron, sans-serif";
  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';

  const COLOR_MAIN = "#0f2342";
  const COLOR_MUTED = "#2d4a6e";
  const COLOR_OUTLINE = "#ffffff";
  const TEXT_OUTLINE_WIDTH = 3;

  const GUIDE_MAIN = "日付を入力してください";
  const GUIDE_SUB = "上のフォームで投稿日を選択";
  const CTA_LINE1 = "プロフィールのリンクから";
  const CTA_LINE2 = "再生リストをご覧ください";

  const F_DATE_MAIN = "700 62px " + FONT_ORBITRON;
  const F_DATE_DAY = "700 62px " + FONT_JP;
  const F_DATE_SUFFIX = "700 62px " + FONT_JP;
  const F_GUIDE = "700 56px " + FONT_JP;
  const F_CTA = "700 44px " + FONT_JP;

  const TEXT_AREA_TOP = 1280;
  const MAIN_LINE_Y = 1520;
  const CTA_LINE1_Y = 1660;
  const CTA_LINE2_Y = 1750;

  const canvas = document.getElementById("exportCanvas");
  const ctx = canvas.getContext("2d");
  const saveImageEl = document.getElementById("saveImage");
  const statusEl = document.getElementById("statusMsg");

  let lastPngDataUrl = "";
  let lastBlob = null;
  let bgImage = null;
  let bgReady = false;
  let fontsReady = false;

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

  function strokeAndFillText(text, x, y, color) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = COLOR_OUTLINE;
    ctx.lineWidth = TEXT_OUTLINE_WIDTH;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawCenteredText(cx, y, text, font, color) {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    strokeAndFillText(text, cx, y, color);
  }

  function drawDateMainLine(cx, y, parts) {
    const main = parts.m + "/" + parts.d;
    const day = "(" + parts.weekday + ")";
    const suffix = "の動画を投稿しました！";

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    ctx.font = F_DATE_MAIN;
    const mainW = ctx.measureText(main).width;

    ctx.font = F_DATE_DAY;
    const dayW = ctx.measureText(day).width;

    ctx.font = F_DATE_SUFFIX;
    const suffixW = ctx.measureText(suffix).width;

    const gap = 4;
    const totalW = mainW + gap + dayW + gap + suffixW;
    let x = cx - totalW / 2;

    ctx.font = F_DATE_MAIN;
    strokeAndFillText(main, x, y, COLOR_MAIN);
    x += mainW + gap;

    ctx.font = F_DATE_DAY;
    strokeAndFillText(day, x, y, COLOR_MUTED);
    x += dayW + gap;

    ctx.font = F_DATE_SUFFIX;
    strokeAndFillText(suffix, x, y, COLOR_MAIN);
  }

  function drawBackground() {
    if (bgImage && bgImage.naturalWidth) {
      ctx.drawImage(bgImage, 0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    ctx.fillStyle = "#a8d4f0";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawStory() {
    if (!bgReady || !fontsReady) return;

    const state = getFormState();
    const cx = CANVAS_W / 2;

    drawBackground();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TEXT_AREA_TOP, CANVAS_W, CANVAS_H - TEXT_AREA_TOP);
    ctx.clip();

    if (state.dateParts) {
      drawDateMainLine(cx, MAIN_LINE_Y, state.dateParts);
      drawCenteredText(cx, CTA_LINE1_Y, CTA_LINE1, F_CTA, COLOR_MAIN);
      drawCenteredText(cx, CTA_LINE2_Y, CTA_LINE2, F_CTA, COLOR_MAIN);
    } else {
      drawCenteredText(cx, MAIN_LINE_Y, GUIDE_MAIN, F_GUIDE, COLOR_MAIN);
      drawCenteredText(cx, CTA_LINE1_Y, GUIDE_SUB, F_CTA, COLOR_MUTED);
    }

    ctx.restore();
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

  function loadBackgroundImage() {
    bgImage = new Image();
    bgImage.onload = function () {
      bgReady = true;
      if (fontsReady) drawStory();
    };
    bgImage.onerror = function () {
      bgReady = true;
      if (fontsReady) drawStory();
    };
    bgImage.src = BACKGROUND_URL;
  }

  function loadCanvasFonts() {
    function onFontsDone() {
      fontsReady = true;
      if (bgReady) drawStory();
    }

    if (!document.fonts || !document.fonts.load) {
      onFontsDone();
      return;
    }

    Promise.all([
      document.fonts.load(F_DATE_MAIN),
      document.fonts.load(F_DATE_DAY),
      document.fonts.load(F_DATE_SUFFIX),
      document.fonts.load(F_GUIDE),
      document.fonts.load(F_CTA),
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
    loadCanvasFonts();
    bindEvents();
  });
})();
