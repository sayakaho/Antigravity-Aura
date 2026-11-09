export function formatCompactNumber(n: number, millionDecimals: 1 | 2 = 1): string {
  if (!n || n <= 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(millionDecimals) + 'M';
  if (n >= 10_000) return Math.round(n / 1_000) + 'k';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function formatFullNumber(n: number): string {
  return (n || 0).toLocaleString('en-US');
}

export function formatLocalDateKey(dateObj: Date): string {
  const yr = dateObj.getFullYear();
  const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dy = String(dateObj.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

export function formatLocalDateAndHourKeys(dateObj: Date): { dateKey: string; hourKey: string } {
  const dateKey = formatLocalDateKey(dateObj);
  const hr = String(dateObj.getHours()).padStart(2, '0');
  return { dateKey, hourKey: `${dateKey} ${hr}:00` };
}

export function formatDateLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(5);
  }
}

export function formatFullDate(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
