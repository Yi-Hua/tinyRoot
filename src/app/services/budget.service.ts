import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private supabase: SupabaseClient;

  constructor() {
    // 1. 初始化 Supabase 連線
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);
  }

  // --- 功能 A: 取得所有交易記錄 ---
  async getTransactions() {
    const { data, error } = await this.supabase
      .from('transactions')          // 指定資料表
      .select('*')                   // 抓取所有欄位
      .order('date', { ascending: false }); // 按日期降序排列 (新的在上面)

    if (error) {
      console.error('讀取失敗:', error);
      return [];
    }
    return data as Transaction[];
  }

  // --- 功能 B: 新增一筆交易 ---
  async addTransaction(transaction: Transaction) {
    // 移除 id 和 created_at，因為這些是資料庫自動生成的
    const { id, created_at, ...newRecord } = transaction;

    const { data, error } = await this.supabase
      .from('transactions')
      .insert(newRecord)
      .select(); // 插入後回傳那筆資料讓我們確認

    if (error) {
      console.error('新增失敗:', error);
      throw error;
    }
    return data[0];
  }

  // --- 功能 C: 刪除交易 (之後可能會用到) ---
  async deleteTransaction(id: number) {
    const { error } = await this.supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('刪除失敗:', error);
      throw error;
    }
  }
}
