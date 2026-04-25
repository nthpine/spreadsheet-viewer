/**
 * NORTH PINE 参加者ビュー用 Web API
 *
 * デプロイ手順（概要）:
 * 1. このスプレッドシートに紐づく Apps Script エディタで本ファイルを貼り付ける。
 * 2. プロジェクトの「プロジェクトの設定」→「スクリプト プロパティ」に
 *    SPREADSHEET_ID を追加（省略時は下の FALLBACK を使用）。
 * 3. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員（または組織内）
 * 4. 発行された URL を index.html の GAS_WEB_APP_URL に貼る。
 *
 * セル書式: 背景 #ff9900 ＝初参加、文字色 #ff0000 ＝女性。
 *
 * エンドポイント:
 * - GET  ?sheet=YYYYMM  または ?sheet=参加者
 * - POST JSON: { "sheet": "202604" } または form: sheet=202604
 */

var SPREADSHEET_ID_FALLBACK = "1-07mnQUToyJjD2pNau99a0dCLmg_0chswzvv3eW4t30";

/** index.html の LAYOUT と一致させる（1始まり行番号） */
var LAYOUT = {
  dateRow: 1,
  placeRow: 2,
  nameStartRow: 3,
  nameEndRow: 18,
};

var MAX_PARTICIPANTS = 15;

var FIRST_TIME_MARKERS = [
  "【初参加】",
  "（初）",
  "(初)",
  "【初】",
  "初参加",
  "［初］",
  "[初]",
];

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    var sheetName = extractSheetName_(e);
    assertAllowedSheetName_(sheetName);
    var sessions = buildSessionsForSheet_(sheetName);
    return jsonOutput_({
      ok: true,
      sheet: sheetName,
      layout: LAYOUT,
      sessions: sessions,
    });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}

function extractSheetName_(e) {
  if (e && e.parameter && e.parameter.sheet) {
    return String(e.parameter.sheet).trim();
  }
  if (e && e.postData && e.postData.contents) {
    var ct = (e.postData.type || "").toLowerCase();
    if (ct.indexOf("json") !== -1) {
      try {
        var data = JSON.parse(e.postData.contents);
        if (data && data.sheet) return String(data.sheet).trim();
      } catch (ignore) {
        /* fall through */
      }
    }
  }
  if (e && e.postData && e.postData.contents) {
    var raw = String(e.postData.contents);
    var m = raw.match(/(?:^|&)sheet=([^&]*)/);
    if (m) return decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
  }
  throw new Error("sheet パラメータが必要です（例: ?sheet=202604）");
}

function assertAllowedSheetName_(name) {
  if (!name) throw new Error("sheet が空です");
  if (/^\d{6}$/.test(name)) return;
  if (name === "参加者") return;
  throw new Error("許可されていないシート名です");
}

function getSpreadsheetId_() {
  var p = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  return p && String(p).trim() ? String(p).trim() : SPREADSHEET_ID_FALLBACK;
}

function jsonOutput_(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function isSessionCountLabel_(s) {
  s = String(s || "").trim();
  return s === "開催回数" || s.indexOf("開催回数") === 0;
}

function normalizeHex6_(hex) {
  var h = String(hex || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return h.length === 6 ? h : "";
}

/** 初参加セル背景: #ff9900（スプレッドシートと同一） */
function isFirstTimeBackground_(hex) {
  return normalizeHex6_(hex) === "ff9900";
}

/** 女性の文字色: #ff0000（スプレッドシートと同一） */
function isFemaleFontColor_(hex) {
  return normalizeHex6_(hex) === "ff0000";
}

function parseParticipantText_(raw) {
  if (!raw || !String(raw).trim()) {
    return { display: "", isFirstFromText: false };
  }
  var t = String(raw);
  var isFirst = false;
  for (var i = 0; i < FIRST_TIME_MARKERS.length; i++) {
    var mk = FIRST_TIME_MARKERS[i];
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
    display: t || String(raw).trim(),
    isFirstFromText: isFirst,
  };
}

function buildSessionsForSheet_(sheetName) {
  var ss = SpreadsheetApp.openById(getSpreadsheetId_());
  var sh = ss.getSheetByName(sheetName);
  if (!sh) {
    throw new Error("シートが見つかりません: " + sheetName);
  }

  var lastRow = Math.max(sh.getLastRow(), LAYOUT.nameEndRow);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var r = sh.getRange(1, 1, lastRow, lastCol);
  var values = r.getDisplayValues();
  var bgs = r.getBackgrounds();
  var fgs = r.getFontColors();

  var dr = LAYOUT.dateRow - 1;
  var pr = LAYOUT.placeRow - 1;
  var ns = LAYOUT.nameStartRow - 1;
  var ne = LAYOUT.nameEndRow - 1;

  var sessions = [];
  for (var c = 0; c < lastCol; c++) {
    var date = cell_(values, dr, c);
    if (!date) continue;

    var place = cell_(values, pr, c);
    var slots = [];
    var footer = false;
    for (var i = 0; i < MAX_PARTICIPANTS; i++) {
      var row = ns + i;
      if (footer || row > ne || row >= values.length) {
        slots.push({ display: "", isFirst: false, isFemale: false });
        continue;
      }
      var rawVal = cell_(values, row, c);
      if (isSessionCountLabel_(rawVal)) {
        footer = true;
        slots.push({ display: "", isFirst: false, isFemale: false });
        continue;
      }
      var bgHex = cellBg_(bgs, row, c);
      var fgHex = cellBg_(fgs, row, c);
      var parsed = parseParticipantText_(rawVal);
      var isFirst =
        parsed.isFirstFromText || isFirstTimeBackground_(bgHex);
      var isFemale = isFemaleFontColor_(fgHex);
      slots.push({
        display: parsed.display,
        isFirst: isFirst,
        isFemale: isFemale,
      });
    }

    sessions.push({
      col: c,
      date: date,
      place: place || "—",
      slots: slots,
    });
  }
  return sessions;
}

function cell_(grid, r, c) {
  if (!grid[r] || grid[r][c] === undefined || grid[r][c] === null) return "";
  return String(grid[r][c]).trim();
}

function cellBg_(bgGrid, r, c) {
  if (!bgGrid[r] || bgGrid[r][c] === undefined) return "";
  return String(bgGrid[r][c] || "");
}
