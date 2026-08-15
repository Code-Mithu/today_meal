import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  Expenses: undefined;
  Meals: undefined;
  Reports: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  ExpenseDetail: { expenseId: string };
  AddExpense: undefined;
  EditExpense: { expenseId: string };
  Contributions: undefined;
  DailyMenu: { date?: string };
  MenuArchive: undefined;
  Members: undefined;
  MemberDetail: { memberId: string };
  GroupSettings: undefined;
  Categories: undefined;
  Vendors: undefined;
  AuditLog: undefined;
};

export type RootStackParamList = MainStackParamList;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
