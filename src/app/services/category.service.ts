import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { LedgerService } from './ledger.service';
import { BehaviorSubject } from 'rxjs';

export interface Category {
  id: string;
  ledger_id?: string;
  name: string;
  icon: string;            // emoji 或 ionicon 名稱
  type: 'expense' | 'income';
  created_at?: string;
}

// 第一次使用時自動建立的「育兒帳本」預設分類
const DEFAULT_BABY_CATEGORIES: Pick<Category, 'name' | 'icon' | 'type'>[] = [
  { name: '寶貝日常',  icon: '🍼', type: 'expense' },  // 奶粉、尿布、衣物
  { name: '教育成長',  icon: '📚', type: 'expense' },  // 教具、繪本、課程
  { name: '醫療保健',  icon: '🏥', type: 'expense' },  // 看病、保健品
  { name: '家庭生活',  icon: '🏠', type: 'expense' },  // 三餐、家用
  { name: '自我愛護',  icon: '☕️', type: 'expense' },  // 媽媽爸爸自己
  { name: '教育金',    icon: '🎓', type: 'expense' },  // 為未來存的
  { name: '薪資收入',  icon: '💰', type: 'income' },
  { name: '其他收入',  icon: '🎁', type: 'income' },
];

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private supabase: SupabaseClient;
  private ledgerSvc = inject(LedgerService);

  private _categories = new BehaviorSubject<Category[]>([]);
  get categories$() { return this._categories.asObservable(); }
  get categories() { return this._categories.value; }

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);

    // 帳本切換時自動切換分類
    this.ledgerSvc.currentLedger$.subscribe(ledger => {
      if (ledger?.id) this.loadCategories(ledger.id);
      else this._categories.next([]);
    });
  }

  async loadCategories(ledgerId: string) {
    const { data, error } = await this.supabase
      .from('categories')
      .select('*')
      .eq('ledger_id', ledgerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('載入分類失敗', error);
      this._categories.next([]);
      return;
    }

    let list = (data ?? []) as Category[];
    // 該帳本還沒分類 → 自動 seed 一組育兒預設
    if (list.length === 0) {
      list = await this.seedDefaults(ledgerId);
    }
    this._categories.next(list);
  }

  private async seedDefaults(ledgerId: string): Promise<Category[]> {
    const rows = DEFAULT_BABY_CATEGORIES.map(c => ({ ...c, ledger_id: ledgerId }));
    const { data, error } = await this.supabase
      .from('categories')
      .insert(rows)
      .select();
    if (error) {
      console.error('建立預設分類失敗', error);
      return [];
    }
    return (data ?? []) as Category[];
  }

  // UI 顯示用:依 id 反查
  findById(id: string): Category | undefined {
    return this._categories.value.find(c => c.id === id);
  }

  async addCategory(name: string, icon: string, type: 'expense' | 'income') {
    const ledger = this.ledgerSvc.currentLedger;
    if (!ledger?.id) throw new Error('尚未選擇帳本');

    const { error } = await this.supabase
      .from('categories')
      .insert({ ledger_id: ledger.id, name, icon, type });

    if (error) throw error;
    await this.loadCategories(ledger.id);
  }

  async deleteCategory(id: string) {
    const { error } = await this.supabase
      .from('categories')
      .delete()
      .eq('id', id);
    if (error) throw error;

    const ledger = this.ledgerSvc.currentLedger;
    if (ledger?.id) await this.loadCategories(ledger.id);
  }
}
