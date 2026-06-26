/**
 * 【MOCK】カレンダー画面プレビュー用データ — push 前に削除可
 */
(function (global) {
  "use strict";

  var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  var MAX = 15;

  function emptySlots() {
    var slots = [];
    for (var i = 1; i <= MAX; i++) {
      slots.push({
        seq: i,
        display: "",
        isFirst: false,
        isFemale: false,
        isUnconfirmed: false,
      });
    }
    return slots;
  }

  function fillSlots(names, flags) {
    var slots = emptySlots();
    var i;
    for (i = 0; i < names.length && i < MAX; i++) {
      var f = flags[i] || {};
      slots[i] = {
        seq: i + 1,
        display: names[i],
        isFirst: !!f.isFirst,
        isFemale: !!f.isFemale,
        isUnconfirmed: !!f.isUnconfirmed,
      };
    }
    return slots;
  }

  function sessionKey(dateLabel, place) {
    return String(dateLabel).replace(/\s+/g, "") + "\t" + String(place).replace(/^@/, "");
  }

  function makeTeamSession(year, month, day, place, teamNames) {
    var d = new Date(year, month - 1, day);
    var dow = WEEKDAYS[d.getDay()];
    var dateLabel = month + "/" + day + "(" + dow + ")";
    var p = place.charAt(0) === "@" ? place : "@" + place;
    var key = sessionKey(dateLabel, p);
    var slots = emptySlots();
    var i;
    for (i = 0; i < 3; i++) {
      slots[i] = {
        seq: i + 1,
        display: teamNames[i] || "",
        isFirst: false,
        isFemale: false,
        isUnconfirmed: false,
      };
    }
    var filled = 0;
    for (i = 0; i < 3; i++) {
      if (slots[i].display) filled++;
    }
    var session = {
      sessionKey: key,
      dateLabel: dateLabel,
      place: p,
      year: year,
      month: month,
      day: day,
      dateIso:
        year +
        "-" +
        ("0" + month).slice(-2) +
        "-" +
        ("0" + day).slice(-2),
      filledCount: filled,
      maxSlots: 3,
      sessionType: "team",
      hasFirst: false,
      hasUnconfirmed: false,
    };
    var group = {
      sessionKey: key,
      dateLabel: dateLabel,
      place: p,
      year: year,
      month: month,
      day: day,
      dateIso: session.dateIso,
      filledCount: filled,
      maxSlots: 3,
      sessionType: "team",
      hasFirst: false,
      hasUnconfirmed: false,
      slots: slots,
    };
    return { session: session, group: group };
  }

  function makeSession(year, month, day, place, names, flags) {
    var d = new Date(year, month - 1, day);
    var dow = WEEKDAYS[d.getDay()];
    var dateLabel = month + "/" + day + "(" + dow + ")";
    var p = place.charAt(0) === "@" ? place : "@" + place;
    var key = sessionKey(dateLabel, p);
    var slots = fillSlots(names, flags);
    var filled = 0;
    var j;
    for (j = 0; j < slots.length; j++) {
      if (slots[j].display) filled++;
    }
    var session = {
      sessionKey: key,
      dateLabel: dateLabel,
      place: p,
      year: year,
      month: month,
      day: day,
      dateIso:
        year +
        "-" +
        ("0" + month).slice(-2) +
        "-" +
        ("0" + day).slice(-2),
      filledCount: filled,
      maxSlots: MAX,
      sessionType: "individual",
      hasFirst: false,
      hasUnconfirmed: false,
    };
    for (j = 0; j < slots.length; j++) {
      if (slots[j].isFirst) session.hasFirst = true;
      if (slots[j].isUnconfirmed) session.hasUnconfirmed = true;
    }
    var group = {
      sessionKey: key,
      dateLabel: dateLabel,
      place: p,
      year: year,
      month: month,
      day: day,
      dateIso: session.dateIso,
      filledCount: filled,
      maxSlots: MAX,
      sessionType: "individual",
      hasFirst: session.hasFirst,
      hasUnconfirmed: session.hasUnconfirmed,
      slots: slots,
    };
    return { session: session, group: group };
  }

  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth() + 1;
  var next = new Date(y, now.getMonth() + 1, 1);
  var y2 = next.getFullYear();
  var m2 = next.getMonth() + 1;
  var today = now.getDate();

  var built = [
    makeSession(
      y,
      m,
      Math.max(3, 1),
      "美香保中",
      ["山田 太郎", "佐藤 健", "鈴木 美咲", "田中 大輔", "伊藤 翔"],
      [{}, { isFirst: true }, { isFemale: true }, { isUnconfirmed: true }, {}],
    ),
    makeSession(
      y,
      m,
      Math.min(today + 5, new Date(y, m, 0).getDate()),
      "菊水小学校",
      ["渡辺 亮", "中村 優花", "小林 直樹", "加藤 誠", "吉田 浩二", "山本 葵", "松本 陸"],
      [{}, { isFirst: true, isFemale: true }, {}, {}, {}, { isFemale: true }, {}],
    ),
    makeSession(y, m, today, "札幌ドーム", ["高橋 誠", "木村 翔", "林 優", "清水 大", "森 健"], [{}, {}, {}, {}, {}]),
    makeTeamSession(y, m, Math.min(today + 3, new Date(y, m, 0).getDate()), "北高校", [
      "NORTH PINE",
      "BLACK WINGS",
      "CRASH BALLERS",
    ]),
    makeSession(
      y2,
      m2,
      7,
      "美香保中",
      ["青木 一", "石井 二", "橋本 三", "藤田 四", "後藤 五", "長谷川 六", "村上 七", "近藤 八"],
      [],
    ),
    makeSession(y2, m2, 14, "澄川小学校", ["岡田 九", "坂本 十"], [{ isFirst: true }, {}]),
  ];

  var sessions = [];
  var groupByKey = {};
  var i;
  for (i = 0; i < built.length; i++) {
    sessions.push(built[i].session);
    groupByKey[built[i].session.sessionKey] = built[i].group;
  }

  sessions.sort(function (a, b) {
    if (a.dateIso !== b.dateIso) return a.dateIso < b.dateIso ? -1 : 1;
    return String(a.place).localeCompare(String(b.place), "ja");
  });

  global.MOCK_CALENDAR_BUNDLE = {
    range: {
      startYear: y,
      startMonth: m,
      endYear: y2,
      endMonth: m2,
    },
    sessions: sessions,
    groupByKey: groupByKey,
  };
})(typeof window !== "undefined" ? window : globalThis);
