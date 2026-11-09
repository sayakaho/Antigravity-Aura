import { formatLocalDateKey } from '../../shared/format';

export type TimeRangeOption =
  | 'session'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | 'last-7-days'
  | 'last-30-days'
  | 'custom';

export interface DateRangeBounds {
  startDate: string;
  endDate: string;
}

const MAX_CONTINUOUS_DAYS = 731;

function shiftDays(base: Date, deltaDays: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaDays);
  return d;
}

export function getRangeBounds(
  range: TimeRangeOption,
  customStart = '',
  customEnd = '',
  now = new Date()
): DateRangeBounds {
  const today = formatLocalDateKey(now);

  switch (range) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const y = formatLocalDateKey(shiftDays(now, -1));
      return { startDate: y, endDate: y };
    }
    case 'this-week': {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = shiftDays(now, diffToMonday);
      const sunday = shiftDays(monday, 6);
      return {
        startDate: formatLocalDateKey(monday),
        endDate: formatLocalDateKey(sunday)
      };
    }
    case 'this-month': {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: formatLocalDateKey(firstOfMonth),
        endDate: today
      };
    }
    case 'last-7-days':
      return {
        startDate: formatLocalDateKey(shiftDays(now, -6)),
        endDate: today
      };
    case 'custom': {
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(customStart) &&
        /^\d{4}-\d{2}-\d{2}$/.test(customEnd)
      ) {
        return customStart <= customEnd
          ? { startDate: customStart, endDate: customEnd }
          : { startDate: customEnd, endDate: customStart };
      }
      return {
        startDate: formatLocalDateKey(shiftDays(now, -29)),
        endDate: today
      };
    }
    case 'last-30-days':
    default:
      return {
        startDate: formatLocalDateKey(shiftDays(now, -29)),
        endDate: today
      };
  }
}

export function generateContinuousDateList(startStr: string, endStr: string): string[] {
  const curr = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  if (Number.isNaN(curr.getTime()) || Number.isNaN(end.getTime()) || curr > end) {
    return [startStr];
  }

  const result: string[] = [];
  while (curr <= end && result.length < MAX_CONTINUOUS_DAYS) {
    result.push(formatLocalDateKey(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return result;
}

export function getFilterDatesForRange(
  range: TimeRangeOption,
  customStart = '',
  customEnd = '',
  now = new Date()
): string[] {
  const { startDate, endDate } = getRangeBounds(range, customStart, customEnd, now);
  return generateContinuousDateList(startDate, endDate);
}

export function getRangeDisplayTitle(range: TimeRangeOption): string {
  switch (range) {
    case 'session':
      return 'Active Session';
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'this-week':
      return 'This Week';
    case 'this-month':
      return 'This Month';
    case 'last-7-days':
      return 'Last 7 Days';
    case 'last-30-days':
      return 'Last 30 Days';
    case 'custom':
      return 'Custom Range';
    default:
      return 'Overview';
  }
}
