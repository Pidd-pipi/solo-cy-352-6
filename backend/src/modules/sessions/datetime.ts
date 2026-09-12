const START_TIME_PATTERN =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * 解析开局时间：仅接受 ISO 8601（日期与时间之间允许空格分隔）。
 * 年月日必须在日历上真实存在（拒绝 2 月 30 日、平年 2 月 29 日、
 * 小月 31 日等越界输入），不允许解析引擎把越界日期推后到其他日期。
 * 无法解析时返回 NaN。
 */
export function parseStartTime(value: unknown): number {
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const match = START_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return Number.NaN;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, milliText, zoneText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = hourText === undefined ? 0 : Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return Number.NaN;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return Number.NaN;
  }

  // 分量已确认在日历范围内，交给 Date.parse 计算绝对时刻（含时区偏移）
  const pad = (num: number) => String(num).padStart(2, "0");
  const iso =
    `${yearText}-${pad(month)}-${pad(day)}` +
    `T${pad(hour)}:${pad(minute)}:${pad(second)}` +
    `${milliText ?? ""}${zoneText ?? ""}`;
  return Date.parse(iso);
}
