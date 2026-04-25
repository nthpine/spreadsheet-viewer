/**
 * NORTH PINE 参加者ビュー用 Web API（レガシー）。
 * 現在の index.html は公開 CSV / gviz のみで取得しており、本スクリプトは参照しない。
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
 * セル書式: 背景 #ff9900 付近＝初参加、文字色 #ff0000 付近＝女性（getBackgrounds / getFontColors の表記差を吸収）。
 *
 * エンドポイント:
 * - GET  ?sheet=YYYYMM  または ?sheet=参加者
 * - POST JSON: { "sheet": "202604" } または form: sheet=202604
 * - GET  ?bundle=1&months=202604,202605&lookup=参加者 … 複数月＋参加者を1レスポンスで返す（高速化）
 * - GET  ?bundle=1&tabs=1&includeSecond=0|1&lookup=参加者 … 左から1番目のシート（includeSecond=1 のときは2番目も）＋参加者
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
    if (e && e.parameter && String(e.parameter.bundle || "") === "1") {
      if (String(e.parameter.tabs || "") === "1") {
        return handleTabOrderBundle_(e);
      }
      return handleBundleRequest_(e);
    }
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

/**
 * 複数月シートと参加者シートを1回で返す。
 * GET: ?bundle=1&months=202604,202605&lookup=参加者
 */
function handleBundleRequest_(e) {
  var monthsStr = "";
  if (e.parameter && e.parameter.months) {
    monthsStr = String(e.parameter.months);
  }
  if (!monthsStr && e.postData && e.postData.contents) {
    try {
      var data = JSON.parse(e.postData.contents);
      if (data && data.months) {
        monthsStr = Array.isArray(data.months)
          ? data.months.join(",")
          : String(data.months);
      }
    } catch (ignore) {}
  }
  if (!monthsStr) {
    throw new Error(
      "months が必要です（例: ?bundle=1&months=202604,202605&lookup=参加者）",
    );
  }
  var lookupName = "参加者";
  if (e.parameter && e.parameter.lookup) {
    lookupName = String(e.parameter.lookup).trim() || lookupName;
  }
  assertAllowedSheetName_(lookupName);

  var parts = monthsStr.split(",").map(function (x) {
    return String(x).trim();
  });
  var months = [];
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    assertAllowedSheetName_(parts[i]);
    months.push(parts[i]);
  }
  if (!months.length) {
    throw new Error("months に有効な YYYYMM がありません");
  }

  var sheets = {};
  for (var j = 0; j < months.length; j++) {
    var ym = months[j];
    try {
      sheets[ym] = buildSessionsForSheet_(ym);
    } catch (err) {
      sheets[ym] = [];
    }
  }

  var lookupSessions = [];
  try {
    lookupSessions = buildSessionsForSheet_(lookupName);
  } catch (err2) {
    lookupSessions = [];
  }

  return jsonOutput_({
    ok: true,
    bundle: true,
    layout: LAYOUT,
    sheets: sheets,
    lookup: {
      sheet: lookupName,
      sessions: lookupSessions,
    },
  });
}

/**
 * 左から1番目（必須）と、includeSecond=1 のとき2番目のシートのみ読む（軽量化）。
 * GET: ?bundle=1&tabs=1&includeSecond=0&lookup=参加者
 */
function handleTabOrderBundle_(e) {
  var lookupName = "参加者";
  if (e.parameter && e.parameter.lookup) {
    lookupName = String(e.parameter.lookup).trim() || lookupName;
  }
  assertAllowedSheetName_(lookupName);

  var ss = SpreadsheetApp.openById(getSpreadsheetId_());
  var all = ss.getSheets();
  if (!all.length) {
    throw new Error("シートがありません");
  }
  var includeSecond =
    e.parameter && String(e.parameter.includeSecond) === "1";

  var outList = [];
  outList.push({
    tabIndex: 0,
    sheetName: all[0].getName(),
    sessions: buildSessionsForSheetObject_(all[0]),
  });
  if (includeSecond && all.length > 1) {
    outList.push({
      tabIndex: 1,
      sheetName: all[1].getName(),
      sessions: buildSessionsForSheetObject_(all[1]),
    });
  }

  var lookupSessions = [];
  try {
    lookupSessions = buildSessionsForSheet_(lookupName);
  } catch (err2) {
    lookupSessions = [];
  }

  return jsonOutput_({
    ok: true,
    bundle: true,
    tabMode: true,
    layout: LAYOUT,
    sheets: outList,
    lookup: {
      sheet: lookupName,
      sessions: lookupSessions,
    },
  });
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

/**
 * スプレッドシートが返す色文字列（#RRGGBB / #AARRGGBB / rgb(...)）を RGB255 にする。
 */
function parseColorToRgb255_(s) {
  s = String(s || "").trim();
  if (!s) return null;
  var mRgb = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (mRgb) {
    return {
      r: Math.round(Number(mRgb[1])),
      g: Math.round(Number(mRgb[2])),
      b: Math.round(Number(mRgb[3])),
    };
  }
  var h = s.replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{8}$/.test(h)) {
    h = h.substring(2);
  }
  if (/^[0-9a-f]{3}$/.test(h)) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function nearRgb_(c, r, g, b, tol) {
  if (!c) return false;
  return (
    Math.abs(c.r - r) <= tol &&
    Math.abs(c.g - g) <= tol &&
    Math.abs(c.b - b) <= tol
  );
}

/** 初参加セル背景: #ff9900 付近（テーマ変換の誤差を許容） */
function isFirstTimeBackground_(hex) {
  var c = parseColorToRgb255_(hex);
  if (!c) return false;
  return nearRgb_(c, 255, 153, 0, 18);
}

/** 女性の文字色: #ff0000 付近 */
function isFemaleFontColor_(hex) {
  var c = parseColorToRgb255_(hex);
  if (!c) return false;
  return nearRgb_(c, 255, 0, 0, 10);
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
  return buildSessionsForSheetObject_(sh);
}

function buildSessionsForSheetObject_(sh) {
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
  sessions.sort(function (a, b) {
    return a.col - b.col;
  });
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
