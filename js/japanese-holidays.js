/**
 * 日本の祝日判定（振替休日・国民の休日を含む）
 */
(function (global) {
  "use strict";

  const cache = Object.create(null);

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function dateKey(year, month, day) {
    return year + "-" + pad2(month) + "-" + pad2(day);
  }

  function nthWeekday(year, month, n, weekday) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === weekday) {
        count++;
        if (count === n) return d;
      }
    }
    return 0;
  }

  function vernalEquinoxDay(year) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function autumnalEquinoxDay(year) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }

  function add(holidays, year, month, day, name) {
    if (!day) return;
    holidays[dateKey(year, month, day)] = name;
  }

  /** 東京五輪など、年ごとの例外 */
  const YEAR_OVERRIDES = {
    2020: [
      [7, 23, "海の日"],
      [7, 24, "スポーツの日"],
      [8, 10, "山の日"],
    ],
    2021: [
      [7, 22, "海の日"],
      [7, 23, "スポーツの日"],
      [8, 8, "山の日"],
      [8, 9, "山の日 振替休日"],
    ],
  };

  function buildBaseHolidays(year) {
    const holidays = Object.create(null);

    add(holidays, year, 1, 1, "元日");
    add(holidays, year, 1, nthWeekday(year, 1, 2, 1), "成人の日");
    add(holidays, year, 2, 11, "建国記念の日");
    if (year >= 2020) add(holidays, year, 2, 23, "天皇誕生日");
    else if (year >= 1989) add(holidays, year, 12, 23, "天皇誕生日");

    add(holidays, year, 3, vernalEquinoxDay(year), "春分の日");
    add(holidays, year, 4, 29, "昭和の日");
    add(holidays, year, 5, 3, "憲法記念日");
    add(holidays, year, 5, 4, "みどりの日");
    add(holidays, year, 5, 5, "こどもの日");
    add(holidays, year, 7, nthWeekday(year, 7, 3, 1), "海の日");
    add(holidays, year, 8, 11, "山の日");
    add(holidays, year, 9, nthWeekday(year, 9, 3, 1), "敬老の日");
    add(holidays, year, 9, autumnalEquinoxDay(year), "秋分の日");
    add(holidays, year, 10, nthWeekday(year, 10, 2, 1), "スポーツの日");
    add(holidays, year, 11, 3, "文化の日");
    add(holidays, year, 11, 23, "勤労感謝の日");

    const overrides = YEAR_OVERRIDES[year];
    if (overrides) {
      overrides.forEach(function (item) {
        add(holidays, year, item[0], item[1], item[2]);
      });
    }

    return holidays;
  }

  function addSubstituteHolidays(holidays, year) {
    const keys = Object.keys(holidays).filter(function (key) {
      return parseInt(key.slice(0, 4), 10) === year;
    });

    keys.forEach(function (key) {
      const parts = key.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const date = new Date(y, m - 1, d);
      if (date.getDay() !== 0) return;

      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      while (next.getFullYear() === year) {
        const k = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
        if (!holidays[k]) {
          holidays[k] = "振替休日";
          break;
        }
        next.setDate(next.getDate() + 1);
      }
    });
  }

  function addCitizensHolidays(holidays, year) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const key = dateKey(year, month, day);
        if (holidays[key]) continue;

        const dow = new Date(year, month - 1, day).getDay();
        if (dow === 0 || dow === 6) continue;

        const prev = new Date(year, month - 1, day - 1);
        const next = new Date(year, month - 1, day + 1);
        const prevKey = dateKey(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
        const nextKey = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
        if (holidays[prevKey] && holidays[nextKey]) {
          holidays[key] = "国民の休日";
        }
      }
    }
  }

  function buildYear(year) {
    if (cache[year]) return cache[year];

    const holidays = buildBaseHolidays(year);
    addSubstituteHolidays(holidays, year);
    addCitizensHolidays(holidays, year);
    addSubstituteHolidays(holidays, year);

    cache[year] = holidays;
    return holidays;
  }

  function isJapaneseHoliday(year, month, day) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
    return Object.prototype.hasOwnProperty.call(buildYear(y), dateKey(y, m, d));
  }

  function getJapaneseHolidayName(year, month, day) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
    return buildYear(y)[dateKey(y, m, d)] || "";
  }

  global.isJapaneseHoliday = isJapaneseHoliday;
  global.getJapaneseHolidayName = getJapaneseHolidayName;
})(typeof window !== "undefined" ? window : globalThis);
