export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidJoinCode(code: string): boolean {
  return code.trim().length >= 4;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isPositiveNumber(value: any): boolean {
  const n = Number(value);
  return !isNaN(n) && n > 0;
}

export function isNonNegativeNumber(value: any): boolean {
  const n = Number(value);
  return !isNaN(n) && n >= 0;
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
}

export function generateClientOperationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
}

export function generateUUID(): string {
  // RFC4122 v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}