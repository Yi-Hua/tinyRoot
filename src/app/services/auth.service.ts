import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;

  // 這裡是一個「廣播電台」，隨時告訴 App 現在是誰登入中
  private _currentUser = new BehaviorSubject<User | null>(null);

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);

    // 初始化時，檢查有沒有舊的登入紀錄
    this.loadUser();

    // 監聽登入狀態改變 (例如突然登出)
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this._currentUser.next(session.user);
      } else {
        this._currentUser.next(null);
      }
    });
  }

  // 取得目前的使用者 (給其他頁面訂閱用)
  get currentUser$() {
    return this._currentUser.asObservable();
  }

  // 1. 註冊
  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  // 2. 登入
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  // 3. 登出
  async signOut() {
    await this.supabase.auth.signOut();
  }

  // 內部用：載入使用者
  private async loadUser() {
    const { data } = await this.supabase.auth.getUser();
    if (data.user) {
      this._currentUser.next(data.user);
    }
  }

  // 取得當下的 User ID (方便記帳用)
  getCurrentUserId(): string | null {
    return this._currentUser.value?.id || null;
  }
}
