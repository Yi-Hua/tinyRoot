import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'expense' | 'income';
  ledger_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private supabase: SupabaseClient;
  private auth = inject(AuthService);

  // 這是我們的資料來源 (Observable)，頁面訂閱它就能即時更新
  private _categories = new BehaviorSubject<Category[]>([]);

  // 暫存目前的帳本 ID
  private _currentLedgerId: string | null = null;

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);
  }

  // 1. 取得分類列表 (給頁面訂閱用)
  get categories$() {
    return this._categories.asObservable();
  }

  // 2. 初始化：找出使用者的帳本 -> 然後載入分類
  async loadCategories() {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    try {
      // A. 如果還不知道帳本 ID，先去查
      if (!this._currentLedgerId) {
        const { data: ledgerUser, error: ledgerError } = await this.supabase
          .from('ledger_users')
          .select('ledger_id')
          .eq('profile_id', userId)
          .single(); // 假設使用者目前只有一本帳本 (MVP階段)

        if (ledgerError || !ledgerUser) throw new Error('找不到使用者的帳本');
        this._currentLedgerId = ledgerUser.ledger_id;
      }

      // B. 根據帳本 ID 抓取分類
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('ledger_id', this._currentLedgerId)
        .order('created_at', { ascending: true }); // 依照建立時間排序

      if (error) throw error;

      // C. 更新資料流
      this._categories.next(data || []);

    } catch (error) {
      console.error('載入分類失敗:', error);
    }
  }

  // 3. 新增分類
  async addCategory(name: string, icon: string, type: string) {
    if (!this._currentLedgerId) await this.loadCategories();

    const newCategory = {
      ledger_id: this._currentLedgerId, // 綁定帳本
      name,
      icon,
      type
    };

    const { error } = await this.supabase
      .from('categories')
      .insert(newCategory);

    if (error) throw error;

    // 新增完畢後，重新抓取一次最新資料
    await this.loadCategories();
  }

  // 4. 刪除分類
  async deleteCategory(id: string) {
    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // 刪除後，重新抓取
    await this.loadCategories();
  }
}
