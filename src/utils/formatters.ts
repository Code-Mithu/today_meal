import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY } from './constants';

export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const symbol = CURRENCY_SYMBOLS[currency] || '';
  const formatted = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString('en-US');
}

export function formatDate(date: string | Date, format: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  if (format === 'MMM d, yyyy') return `${month} ${day}, ${year}`;
  if (format === 'MMM d') return `${month} ${day}`;
  if (format === 'yyyy-MM-dd') return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (format === 'yyyy-MM') return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (format === 'h:mm a') {
    const h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
  }
  return `${month} ${day}, ${year}`;
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return formatDate(d);
}

export function getMonthString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getTodayString(): string {
  return formatDate(new Date(), 'yyyy-MM-dd');
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}