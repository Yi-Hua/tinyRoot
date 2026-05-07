import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';
import { Ledger } from '../models/transaction.model';

const STORAGE_KEY = 'tiny_root_current_ledger';

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private supabase: SupabaseClient;
  private auth = inject(AuthService);

  private _ledgers = new BehaviorSubject<Ledger[]>([]);
  private _currentLedger = new BehaviorSubject<Ledger | null>(null);

  get ledgers$() { return this._ledgers.asObservable(); }
  get currentLedger$() { return this._currentLedger.asObservable(); }
  get currentLedger() { return this._currentLedger.value; }

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);

    // 跟著登入狀態走:登入時載入帳本,登出時清空
    this.auth.currentUser$.subscribe(user => {
      if (user) {
        this.loadLedgers();
      } else {
        this._ledgers.next([]);
        this._currentLedger.next(null);
      }
    });
  }

  // 載入「我參與」的所有帳本
  async loadLedgers() {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    const { data, error } = await this.supabase
      .from('ledger_users')
      .select('ledgers!inner(id, name, type, owner_id, created_at)')
      .eq('profile_id', userId);

    if (error) {
      console.error('載入帳本失敗', error);
      return;
    }

    const list = (data ?? [])
      .map((row: any) => row.ledgers)
      .filter(Boolean) as Ledger[];

    // 第一次使用、還沒任何帳本 → 自動建立預設「寶寶成長帳本」
    if (list.length === 0) {
      const created = await this.createLedger('寶寶成長帳本', 'shared');
      if (created) list.push(created);
    }

    this._ledgers.next(list);

    // 還原上次選的帳本,沒有就用第一本
    const savedId = localStorage.getItem(STORAGE_KEY);
    const restored = list.find(l => l.id === savedId);
    this.setCurrentLedger(restored ?? list[0] ?? null);
  }

  // 切換目前帳本
  setCurrentLedger(ledger: Ledger | null) {
    this._currentLedger.next(ledger);
    if (ledger?.id) {
      localStorage.setItem(STORAGE_KEY, ledger.id);
    }
  }

  // 建立新帳本 (同時把建立者加進 ledger_users)
  async createLedger(name: string, type: 'personal' | 'shared' = 'personal'): Promise<Ledger | null> {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return null;

    const { data: ledger, error } = await this.supabase
      .from('ledgers')
      .insert({ name, type, owner_id: userId })
      .select()
      .single();

    if (error || !ledger) {
      console.error('建立帳本失敗', error);
      return null;
    }

    const { error: linkError } = await this.supabase
      .from('ledger_users')
      .insert({ ledger_id: ledger.id, profile_id: userId, role: 'owner' });

    if (linkError) {
      console.error('加入 ledger_users 失敗', linkError);
    }

    return ledger as Ledger;
  }

  // 邀請其他使用者加入(共享帳本用)
  // 注意:Supabase 預設不允許前端用 email 查 auth.users,
  // 之後需要在 Supabase 建一個 RPC (例如 invite_member)。先預留介面。
  async inviteMember(ledgerId: string, userId: string, role: 'member' | 'owner' = 'member') {
    const { error } = await this.supabase
      .from('ledger_users')
      .insert({ ledger_id: ledgerId, profile_id: userId, role });
    if (error) throw error;
  }
}
