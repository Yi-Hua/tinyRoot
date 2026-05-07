import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { Transaction } from '../models/transaction.model';
import { AuthService } from './auth.service';
import { LedgerService } from './ledger.service';
import { BehaviorSubject } from 'rxjs';

// 給外部呼叫者用的「新增交易輸入」型別
// (id/created_at/ledger_id/profile_id 由 service 自動填)
export type NewTransactionInput = Omit<
  Transaction,
  'id' | 'created_at' | 'ledger_id' | 'profile_id'
>;

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private supabase: SupabaseClient;
  private auth = inject(AuthService);
  private ledgerSvc = inject(LedgerService);

  private _transactions = new BehaviorSubject<Transaction[]>([]);
  get transactions$() { return this._transactions.asObservable(); }
  get transactions() { return this._transactions.value; }

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);

    // 帳本切換時自動重新載入
    this.ledgerSvc.currentLedger$.subscribe(ledger => {
      if (ledger?.id) this.loadTransactions(ledger.id);
      else this._transactions.next([]);
    });
  }

  async loadTransactions(ledgerId: string) {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('讀取失敗:', error);
      this._transactions.next([]);
      return;
    }
    this._transactions.next((data ?? []) as Transaction[]);
  }

  // 新增一筆
  async addTransaction(tx: NewTransactionInput): Promise<Transaction> {
    const ledger = this.ledgerSvc.currentLedger;
    const userId = this.auth.getCurrentUserId();
    if (!ledger?.id) throw new Error('尚未選擇帳本');
    if (!userId) throw new Error('尚未登入');

    const newRecord = {
      ...tx,
      ledger_id: ledger.id,
      profile_id: userId,
      source: tx.source ?? 'manual',
    };

    const { data, error } = await this.supabase
      .from('transactions')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      console.error('新增失敗:', error);
      throw error;
    }

    await this.loadTransactions(ledger.id);
    return data as Transaction;
  }

  // 批次新增 (給載具發票匯入用,自動跳過已存在的 invoice_num)
  async addTransactionsBulk(
    rows: NewTransactionInput[]
  ): Promise<{ inserted: number; skipped: number }> {
    const ledger = this.ledgerSvc.currentLedger;
    const userId = this.auth.getCurrentUserId();
    if (!ledger?.id) throw new Error('尚未選擇帳本');
    if (!userId) throw new Error('尚未登入');
    if (!rows.length) return { inserted: 0, skipped: 0 };

    // 1. 撈本帳本已有的 invoice_num
    const invNums = rows.map(r => r.invoice_num).filter(Boolean) as string[];
    let existing = new Set<string>();
    if (invNums.length) {
      const { data } = await this.supabase
        .from('transactions')
        .select('invoice_num')
        .eq('ledger_id', ledger.id)
        .in('invoice_num', invNums);
      existing = new Set((data ?? []).map((r: any) => r.invoice_num));
    }

    // 2. 過濾重複,補上 ledger_id / profile_id
    const fresh = rows
      .filter(r => !r.invoice_num || !existing.has(r.invoice_num))
      .map(r => ({
        ...r,
        ledger_id: ledger.id!,
        profile_id: userId,
      }));

    const skipped = rows.length - fresh.length;
    if (!fresh.length) return { inserted: 0, skipped };

    const { error } = await this.supabase.from('transactions').insert(fresh);
    if (error) {
      console.error('批次新增失敗:', error);
      throw error;
    }

    await this.loadTransactions(ledger.id);
    return { inserted: fresh.length, skipped };
  }

  async deleteTransaction(id: string) {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('刪除失敗:', error);
      throw error;
    }
    const ledger = this.ledgerSvc.currentLedger;
    if (ledger?.id) await this.loadTransactions(ledger.id);
  }
}
