// Compact yearly activity uses real calendar dates, independent of DST.
import { mondayIndex, ymd, parseYmd } from '../core/dates.js';

const validDay = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && ymd(parseYmd(date)) === date;

export function activityYears(logs, bypass, today = ymd()) {
  const dates = [...Object.keys(logs).filter(date => logs[date]?.length), ...Object.keys(bypass).filter(date => bypass[date])];
  const current = Number(today.slice(0, 4));
  const first = dates.filter(date => date <= today && validDay(date)).reduce((earliest, date) => Math.min(earliest, Number(date.slice(0, 4))), current);
  return Array.from({ length: current - first + 1 }, (_, i) => current - i);
}

export function yearActivity(year, logs, bypass, today = ymd()) {
  const first = mondayIndex(new Date(Date.UTC(year, 0, 1)).getUTCDay());
  const cells = Array(first).fill(null), months = [];
  let trainedDays = 0;
  for (let month = 0; month < 12; month++) {
    months.push({ month, column: Math.floor(cells.length / 7) + 1 });
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let day = 1; day <= days; day++) {
      const date = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const future = date > today, trained = !future && !!logs[date]?.length;
      if (trained) trainedDays++;
      cells.push({ date, trained, bypass: !future && !trained && !!bypass[date], future });
    }
  }
  const columns = Math.ceil(cells.length / 7);
  while (cells.length < columns * 7) cells.push(null);
  return { year, cells, months, columns, trainedDays };
}
