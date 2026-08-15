// App-wide constants

export const APP_NAME = 'Today Meal';

// Sage-green palette matching the web app
export const COLORS = {
  PRIMARY: '#7FBF9B',
  PRIMARY_DARK: '#4F9D8A',
  PRIMARY_LIGHT: '#EAF6EF',
  BACKGROUND: '#F8FAF8',
  CARD: '#FFFFFF',
  TEXT: '#25332C',
  TEXT_MUTED: '#718078',
  BORDER: '#DDE7E1',
  DANGER: '#E25C5C',
  WARNING: '#E8A838',
  SUCCESS: '#4F9D8A',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
} as const;

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'extra'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  extra: 'Extra',
};

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_transfer', label: 'Mobile Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
] as const;

export const DEFAULT_CURRENCY = 'BDT';
export const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  PKR: '₨',
};

export const DATE_FORMATS = {
  DISPLAY: 'MMM d, yyyy',
  DISPLAY_SHORT: 'MMM d',
  INPUT: 'yyyy-MM-dd',
  MONTH: 'yyyy-MM',
  TIME: 'h:mm a',
  DATETIME: 'MMM d, yyyy h:mm a',
} as const;
