// 定義三種支出類別 (50/30/20 法則)
export type BudgetCategory = 'Needs' | 'Wants' | 'Savings' | 'Culture';

// 定義一筆交易的結構
export interface Transaction {
  id?: number;           // 資料庫會自動產生，所以設為可選 (?)
  created_at?: string;   // 建立時間
  date: string;          // 消費日期
  description: string;   // 項目名稱 (例如：奶粉)
  amount: number;        // 金額
  category: BudgetCategory; // 類別
  spender: string;       // 付款人
}

export interface Category {
  id: string;        // 分類代號 (例如: 'food')
  name: string;      // 分類名稱 (例如: '飲食')
  icon: string;      // 圖示名稱 (例如: 'fast-food-outline')
  type: 'expense' | 'income'; // 支出或收入
}
