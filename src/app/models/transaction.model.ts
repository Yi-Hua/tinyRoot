// 帳本本身 (例如:夫妻共享、私人帳本)
export interface Ledger {
  id?: string;
  name: string;
  type?: 'personal' | 'shared';
  owner_id?: string;            // profiles.id
  created_at?: string;
}

// 錢包/帳戶 (現金、銀行、信用卡、電子支付)
export interface Account {
  id?: string;
  ledger_id: string;
  name: string;
  type: string;                 // 'cash' | 'bank' | 'credit_card' | 'ewallet'
  balance?: number;
  created_at?: string;
}

// 一筆交易紀錄 (對齊 v2.0 schema)
export interface Transaction {
  id?: string;
  created_at?: string;
  ledger_id: string;            // 屬於哪一本帳本
  account_id?: string | null;   // 從哪個錢包/帳戶扣錢 (可選)
  category_id?: string | null;  // 分類 FK
  profile_id?: string | null;   // 紀錄/付款的人 (auth.uid)
  amount: number;
  description: string;
  date: string;                 // 'YYYY-MM-DD' (Postgres date 型別)
  type: 'expense' | 'income';
  source?: 'manual' | 'invoice';
  invoice_num?: string;         // 載具發票號碼,匯入去重用
  spender?: string;             // 自由文字「誰付的」例:爸爸 / 媽媽
}

// 預算 (預留給之後做)
export interface Budget {
  id?: string;
  ledger_id: string;
  category_id?: string;
  name: string;
  limit_amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  start_date?: string;
  end_date?: string;
  created_at?: string;
}
