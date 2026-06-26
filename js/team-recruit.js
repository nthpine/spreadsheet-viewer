/**
 * NORTH PINE チーム募集ストーリー画像（1080×1920 × 3枚）
 */
(function () {
  "use strict";

  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const SCALE = 3;
  const FONT_ORBITRON = "Orbitron, sans-serif";
  const FONT_JP = '"Zen Kaku Gothic New", "Hiragino Sans", "Meiryo", sans-serif';

  const COLOR_BG_TOP = "#0b1020";
  const COLOR_BG_BOTTOM = "#1a1035";
  const COLOR_MAIN = "#f1f5f9";
  const COLOR_ACCENT = "#22d3ee";
  const COLOR_ACCENT2 = "#a78bfa";
  const COLOR_MUTED = "#94a3b8";
  const COLOR_DIM = "#64748b";
  const COLOR_LINE = "rgba(255,255,255,0.15)";

  const F_BRAND = "900 " + 36 * SCALE + "px " + FONT_ORBITRON;
  const F_TITLE = "900 " + 44 * SCALE + "px " + FONT_JP;
  const F_HEAD = "900 " + 28 * SCALE + "px " + FONT_JP;
  const F_BODY = "700 " + 24 * SCALE + "px " + FONT_JP;
  const F_BODY_SM = "700 " + 20 * SCALE + "px " + FONT_JP;
  const F_MUTED = "700 " + 18 * SCALE + "px " + FONT_JP;
  const F_HIGHLIGHT = "900 " + 30 * SCALE + "px " + FONT_JP;
  const F_ARROW = "900 " + 32 * SCALE + "px " + FONT_ORBITRON;
  const F_IG = "900 " + 26 * SCALE + "px " + FONT_ORBITRON;

  const SLIDES = [
    {
      id: "announce",
      label: "スライド1：募集のお知らせ",
      filename: "northpine_team_recruit_01_announce.png",
      draw: drawSlideAnnounce,
    },
    {
      id: "format",
      label: "スライド2：試合形式",
      filename: "northpine_team_recruit_02_format.png",
      draw: drawSlideFormat,
    },
    {
      id: "join",
      label: "スライド3：参加方法",
      filename: "northpine_team_recruit_03_join.png",
      draw: drawSlideJoin,
    },
  ];

  let fontsReady = false;
  let ready = false;
  const canvases = [];

  function $(id) {
    return document.getElementById(id);
  }

  function drawBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, CANVAS_W * 0.3, CANVAS_H);
    g.addColorStop(0, COLOR_BG_TOP);
    g.addColorStop(0.55, "#15102a");
    g.addColorStop(1, COLOR_BG_BOTTOM);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const glow = ctx.createRadialGradient(
      CANVAS_W * 0.8,
      CANVAS_H * 0.15,
      0,
      CANVAS_W * 0.8,
      CANVAS_H * 0.15,
      CANVAS_W * 0.55
    );
    glow.addColorStop(0, "rgba(34, 211, 238, 0.12)");
    glow.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const glow2 = ctx.createRadialGradient(
      CANVAS_W * 0.2,
      CANVAS_H * 0.85,
      0,
      CANVAS_W * 0.2,
      CANVAS_H * 0.85,
      CANVAS_W * 0.45
    );
    glow2.addColorStop(0, "rgba(167, 139, 250, 0.1)");
    glow2.addColorStop(1, "rgba(167, 139, 250, 0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawDivider(ctx, cx, y, width) {
    const w = width || 120 * SCALE;
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 2 * SCALE;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx + w / 2, y);
    ctx.stroke();
  }

  function drawBrand(ctx, cx, y) {
    ctx.font = F_BRAND;
    ctx.fillStyle = COLOR_MAIN;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "0.12em";
    ctx.fillText("NORTH PINE", cx, y);
    ctx.letterSpacing = "0px";
  }

  function drawCentered(ctx, text, x, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  }

  function drawMatchDiagram(ctx, cx, y) {
    const matches = [
      ["A", "B"],
      ["B", "C"],
      ["C", "A"],
    ];
    const boxW = 100 * SCALE;
    const boxH = 48 * SCALE;
    const gap = 14 * SCALE;
    const totalW = matches.length * boxW + (matches.length - 1) * gap;
    let x = cx - totalW / 2;

    matches.forEach(function (pair, i) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.strokeStyle = COLOR_LINE;
      ctx.lineWidth = 2 * SCALE;
      roundRect(ctx, x, y - boxH / 2, boxW, boxH, 8 * SCALE);
      ctx.fill();
      ctx.stroke();

      const label = pair[0] + " - " + pair[1];
      drawCentered(ctx, label, x + boxW / 2, y, F_BODY_SM, COLOR_MAIN);

      if (i < matches.length - 1) {
        drawCentered(ctx, "→", x + boxW + gap / 2, y, F_ARROW, COLOR_DIM);
      }
      x += boxW + gap;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
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

  function drawSlideAnnounce(ctx) {
    const cx = CANVAS_W / 2;
    drawBackground(ctx);
    drawBrand(ctx, cx, 110 * SCALE);

    let y = 210 * SCALE;
    drawCentered(ctx, "チーム単位で", cx, y, F_HEAD, COLOR_ACCENT);
    y += 36 * SCALE;
    drawCentered(ctx, "募集します", cx, y, F_HEAD, COLOR_ACCENT);
    y += 46 * SCALE;
    drawDivider(ctx, cx, y);
    y += 40 * SCALE;

    drawCentered(ctx, "これまで", cx, y, F_MUTED, COLOR_MUTED);
    y += 34 * SCALE;
    drawCentered(ctx, "個人15名集まれ", cx, y, F_BODY, COLOR_MAIN);
    y += 46 * SCALE;
    drawCentered(ctx, "↓", cx, y, F_ARROW, COLOR_ACCENT2);
    y += 46 * SCALE;
    drawCentered(ctx, "今後", cx, y, F_MUTED, COLOR_MUTED);
    y += 34 * SCALE;
    drawCentered(ctx, "チームでエントリー", cx, y, F_HIGHLIGHT, COLOR_MAIN);
    y += 50 * SCALE;
    drawDivider(ctx, cx, y, 160 * SCALE);
    y += 40 * SCALE;
    drawCentered(ctx, "開催頻度：月1回前後", cx, y, F_BODY, COLOR_MAIN);
    y += 34 * SCALE;
    drawCentered(ctx, "（日程は調整中）", cx, y, F_MUTED, COLOR_DIM);
  }

  function drawSlideFormat(ctx) {
    const cx = CANVAS_W / 2;
    drawBackground(ctx);
    drawBrand(ctx, cx, 100 * SCALE);

    let y = 195 * SCALE;
    drawCentered(ctx, "試合形式", cx, y, F_TITLE, COLOR_ACCENT);
    y += 36 * SCALE;
    drawCentered(ctx, "これまで通り", cx, y, F_MUTED, COLOR_MUTED);
    y += 42 * SCALE;
    drawDivider(ctx, cx, y);
    y += 38 * SCALE;

    drawCentered(ctx, "3チーム × 各5人", cx, y, F_HIGHLIGHT, COLOR_MAIN);
    y += 38 * SCALE;
    drawCentered(ctx, "最低5人で1チームエントリー", cx, y, F_BODY, COLOR_MAIN);
    y += 34 * SCALE;
    drawCentered(ctx, "3チーム揃ったら開催", cx, y, F_BODY_SM, COLOR_MUTED);
    y += 44 * SCALE;
    drawDivider(ctx, cx, y, 140 * SCALE);
    y += 38 * SCALE;

    drawCentered(ctx, "3チーム総当たり × 3巡", cx, y, F_HIGHLIGHT, COLOR_ACCENT);
    y += 40 * SCALE;
    drawMatchDiagram(ctx, cx, y);
    y += 50 * SCALE;
    drawCentered(ctx, "計9試合（1人あたり6試合）", cx, y, F_BODY, COLOR_MAIN);
    y += 44 * SCALE;
    drawDivider(ctx, cx, y, 120 * SCALE);
    y += 38 * SCALE;
    drawCentered(ctx, "19:15 〜 21:45", cx, y, F_HEAD, COLOR_MAIN);
    y += 34 * SCALE;
    drawCentered(ctx, "札幌市内の学校体育館", cx, y, F_BODY_SM, COLOR_MUTED);
  }

  function drawSlideJoin(ctx) {
    const cx = CANVAS_W / 2;
    drawBackground(ctx);
    drawBrand(ctx, cx, 150 * SCALE);

    let y = 250 * SCALE;
    drawCentered(ctx, "参加について", cx, y, F_TITLE, COLOR_ACCENT);
    y += 56 * SCALE;
    drawDivider(ctx, cx, y);
    y += 48 * SCALE;

    const lines = [
      { text: "場所：東区・豊平区・北区", font: F_BODY, color: COLOR_MAIN, gap: 42 },
      { text: "参加費：300円", font: F_BODY, color: COLOR_MAIN, gap: 42 },
      { text: "対象：バスケ経験者", font: F_BODY, color: COLOR_MAIN, gap: 42 },
      { text: "だいたい30歳まで", font: F_BODY_SM, color: COLOR_MUTED, gap: 36 },
      { text: "他チーム在籍の方も歓迎", font: F_BODY_SM, color: COLOR_MUTED, gap: 36 },
    ];
    lines.forEach(function (line) {
      drawCentered(ctx, line.text, cx, y, line.font, line.color);
      y += line.gap * SCALE;
    });

    y += 20 * SCALE;
    drawDivider(ctx, cx, y, 160 * SCALE);
    y += 48 * SCALE;
    drawCentered(ctx, "参加希望はInstagram DMへ", cx, y, F_BODY, COLOR_MAIN);
    y += 44 * SCALE;
    drawCentered(ctx, "@sapporo_northpine", cx, y, F_IG, COLOR_ACCENT);
    y += 50 * SCALE;
    drawCentered(ctx, "年齢・バスケ歴・性別を", cx, y, F_BODY_SM, COLOR_MUTED);
    y += 34 * SCALE;
    drawCentered(ctx, "記入の上お送りください", cx, y, F_BODY_SM, COLOR_MUTED);
    y += 52 * SCALE;
    drawCentered(ctx, "チーム単位でのエントリー歓迎", cx, y, F_HIGHLIGHT, COLOR_MAIN);
  }

  function loadFonts() {
    const fonts = [F_BRAND, F_TITLE, F_HEAD, F_BODY, F_BODY_SM, F_MUTED, F_HIGHLIGHT, F_ARROW, F_IG];
    if (!document.fonts || !document.fonts.load) {
      fontsReady = true;
      return Promise.resolve();
    }
    return Promise.all(fonts.map(function (f) { return document.fonts.load(f); }))
      .then(function () { return document.fonts.ready; })
      .then(function () { fontsReady = true; })
      .catch(function () { fontsReady = true; });
  }

  function renderSlide(slide, index) {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.id = "slideCanvas" + index;
    canvas.setAttribute("data-filename", slide.filename);
    const ctx = canvas.getContext("2d");
    slide.draw(ctx);
    canvases[index] = canvas;
    return canvas;
  }

  function buildPreviewUI() {
    const area = $("slidesArea");
    area.innerHTML = "";

    SLIDES.forEach(function (slide, i) {
      const canvas = renderSlide(slide, i);
      const block = document.createElement("div");
      block.className = "team-recruit-slide-block";

      const heading = document.createElement("h3");
      heading.textContent = slide.label;
      block.appendChild(heading);

      const wrap = document.createElement("div");
      wrap.className = "invite-preview-wrap";
      const img = document.createElement("img");
      img.alt = slide.label;
      img.width = CANVAS_W;
      img.height = CANVAS_H;
      try {
        img.src = canvas.toDataURL("image/png");
      } catch (e) {
        img.alt = "画像の生成に失敗しました";
      }
      wrap.appendChild(canvas);
      wrap.appendChild(img);
      canvas.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
      block.appendChild(wrap);

      const hint = document.createElement("p");
      hint.className = "save-hint";
      hint.innerHTML =
        'スマホ: 画像を<strong>長押し</strong> →「写真を保存」／' +
        'PC: <strong>右クリック</strong> →「画像を保存」';
      block.appendChild(hint);

      area.appendChild(block);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    if (!canvases.length) return;
    let i = 0;
    function next() {
      if (i >= canvases.length) {
        $("statusMsg").textContent = "3枚のダウンロードが完了しました。";
        return;
      }
      const canvas = canvases[i];
      const filename = canvas.getAttribute("data-filename") || "slide" + (i + 1) + ".png";
      canvas.toBlob(function (blob) {
        if (blob) downloadBlob(blob, filename);
        i += 1;
        setTimeout(next, 300);
      }, "image/png");
    }
    next();
  }

  function showReady() {
    $("loadingArea").style.display = "none";
    $("appContent").classList.add("ready");
    $("btnDownloadAll").disabled = false;
    ready = true;
  }

  /** Playwright 等の自動エクスポート用 */
  window.teamRecruitExport = {
    ready: function () { return ready && fontsReady; },
    slideCount: function () { return SLIDES.length; },
    getDataUrl: function (index) {
      const c = canvases[index];
      return c ? c.toDataURL("image/png") : "";
    },
    getFilename: function (index) {
      return SLIDES[index] ? SLIDES[index].filename : "slide.png";
    },
    redraw: function () {
      SLIDES.forEach(function (slide, i) {
        const ctx = canvases[i].getContext("2d");
        slide.draw(ctx);
      });
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    loadFonts().then(function () {
      buildPreviewUI();
      showReady();
      $("btnDownloadAll").addEventListener("click", downloadAll);
    });
  });
})();
