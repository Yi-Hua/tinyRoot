import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonButton, IonIcon, IonFab, IonFabButton, IonNote,
  AlertController, ToastController, LoadingController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, wallet, leaf, calendarOutline, createOutline,
  cashOutline, leafOutline, scanOutline, cloudDownloadOutline,
  chevronDownOutline, logOutOutline, settingsOutline
} from 'ionicons/icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { BudgetService } from '../services/budget.service';
import { Transaction, Ledger } from '../models/transaction.model';
import { InvoiceService } from '../services/invoice.service';
import { CategoryService, Category } from '../services/category.service';
import { LedgerService } from '../services/ledger.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonButton, IonIcon, IonFab, IonFabButton, IonNote
  ],
})
export class HomePage implements OnInit {
  private budgetService = inject(BudgetService);
  private invoiceService = inject(InvoiceService);
  private categoryService = inject(CategoryService);
  private ledgerService = inject(LedgerService);
  private auth = inject(AuthService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  transactions: Transaction[] = [];
  categories: Category[] = [];
  ledgers: Ledger[] = [];
  currentLedger: Ledger | null = null;

  totalExpense = 0;
  totalIncome = 0;
  defaultSpender = '我';

  constructor() {
    addIcons({
      add, wallet, leaf, calendarOutline, createOutline,
      cashOutline, leafOutline, scanOutline, cloudDownloadOutline,
      chevronDownOutline, logOutOutline, settingsOutline
    });
  }

  ngOnInit() {
    this.budgetService.transactions$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(tx => {
        this.transactions = tx;
        this.totalExpense = this.sumByType(tx, 'expense');
        this.totalIncome  = this.sumByType(tx, 'income');
      });

    this.categoryService.categories$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(cats => this.categories = cats);

    this.ledgerService.ledgers$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(ls => this.ledgers = ls);

    this.ledgerService.currentLedger$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(l => this.currentLedger = l);
  }

  // ===== 顯示 helpers =====
  getCategoryIcon(id?: string | null): string {
    if (!id) return '🌱';
    return this.categoryService.findById(id)?.icon ?? '🌱';
  }
  getCategoryName(id?: string | null): string {
    if (!id) return '未分類';
    return this.categoryService.findById(id)?.name ?? '未分類';
  }
  private sumByType(tx: Transaction[], type: 'expense' | 'income'): number {
    return tx
      .filter(t => t.type === type)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }

  // ===== 切換 / 建立帳本 =====
  async openLedgerPicker() {
    if (!this.ledgers.length) {
      await this.openCreateLedger();
      return;
    }

    const inputs = this.ledgers.map(l => ({
      name: 'ledger',
      type: 'radio' as const,
      label: `${l.type === 'shared' ? '👨‍👩‍👧 ' : '👤 '}${l.name}`,
      value: l.id || '',
      checked: this.currentLedger?.id === l.id,
    }));

    const alert = await this.alertCtrl.create({
      header: '切換帳本',
      inputs,
      buttons: [
        { text: '取消', role: 'cancel' },
        { text: '建立新的...', handler: () => { this.openCreateLedger(); return true; } },
        {
          text: '切換',
          handler: (value: any) => {
            if (typeof value === 'string') {
              const target = this.ledgers.find(l => l.id === value);
              if (target) this.ledgerService.setCurrentLedger(target);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async openCreateLedger() {
    const alert = await this.alertCtrl.create({
      header: '建立新帳本',
      message: '個人帳本只有自己可看;共享帳本可以邀請另一半',
      inputs: [
        { name: 'name', type: 'text', placeholder: '帳本名稱(例:我的私房錢)' },
      ],
      buttons: [
        { text: '取消', role: 'cancel' },
        { text: '建立(個人)', handler: async (data) => { await this.createWithType(data?.name, 'personal'); } },
        { text: '建立(共享)', handler: async (data) => { await this.createWithType(data?.name, 'shared'); } }
      ]
    });
    await alert.present();
  }

  private async createWithType(name: string, type: 'personal' | 'shared') {
    const trimmed = (name || '').trim();
    if (!trimmed) { this.toast('帳本名稱不能空白'); return; }
    const ledger = await this.ledgerService.createLedger(trimmed, type);
    if (ledger) {
      await this.ledgerService.loadLedgers();
      this.ledgerService.setCurrentLedger(ledger);
      this.toast(`已建立:${trimmed}`);
    } else {
      this.toast('建立失敗,請確認 SQL 已執行');
    }
  }

  // ===== 新增記帳 =====
  async openAddModal() {
    if (!this.currentLedger) {
      this.toast('請先選擇或建立一個帳本');
      return;
    }
    if (this.categories.filter(c => c.type === 'expense').length === 0) {
      const a = await this.alertCtrl.create({
        header: '尚無分類',
        message: '請先到「分類管理」建立至少一個分類',
        buttons: [
          { text: '取消', role: 'cancel' },
          { text: '前往設定', handler: () => this.router.navigate(['/settings/categories']) }
        ]
      });
      await a.present();
      return;
    }

    const step1 = await this.alertCtrl.create({
      header: '新增一筆',
      inputs: [
        { name: 'description', type: 'text', placeholder: '項目(例:奶粉)' },
        { name: 'amount', type: 'number', placeholder: '金額' },
      ],
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '下一步',
          handler: async (data) => {
            const desc = (data?.description || '').trim();
            const amt = Number(data?.amount);
            if (!desc || !amt || amt <= 0) {
              this.toast('項目和金額不能空白');
              return false;
            }
            await this.openCategoryPicker(desc, amt);
            return true;
          }
        }
      ]
    });
    await step1.present();
  }

  private async openCategoryPicker(description: string, amount: number) {
    const expenses = this.categories.filter(c => c.type === 'expense');
    const inputs = expenses.map((c, i) => ({
      name: 'category',
      type: 'radio' as const,
      label: `${c.icon} ${c.name}`,
      value: c.id,
      checked: i === 0
    }));

    const alert = await this.alertCtrl.create({
      header: '選擇分類',
      subHeader: `${description} - $${amount}`,
      inputs,
      buttons: [
        { text: '上一步', role: 'cancel' },
        {
          text: '完成',
          handler: async (categoryId: any) => {
            if (typeof categoryId !== 'string' || !categoryId) {
              this.toast('請選一個分類');
              return false;
            }
            const cat = this.categoryService.findById(categoryId);
            try {
              await this.budgetService.addTransaction({
                date: this.todayDate(),
                description,
                amount,
                category_id: categoryId,
                type: cat?.type ?? 'expense',
                spender: this.defaultSpender,
                source: 'manual',
              });
              this.toast('記帳成功 🌱');
              return true;
            } catch (e: any) {
              this.toast('儲存失敗:' + (e?.message || ''));
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ===== 載具發票匯入 =====
  async openSyncModal() {
    if (!this.currentLedger) {
      this.toast('請先選擇帳本');
      return;
    }
    const alert = await this.alertCtrl.create({
      header: '匯入載具發票',
      message: '輸入手機條碼跟驗證碼,自動把最近 30 天的發票匯入記帳',
      inputs: [
        { name: 'barcode', type: 'text', placeholder: '手機條碼(/ABC+123)', value: localStorage.getItem('user_barcode') || '' },
        { name: 'verifyCode', type: 'password', placeholder: '驗證碼' }
      ],
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '匯入',
          handler: async (data) => {
            if (!data?.barcode || !data?.verifyCode) {
              this.toast('條碼和驗證碼都要填');
              return false;
            }
            localStorage.setItem('user_barcode', data.barcode);
            await this.syncData(data.barcode, data.verifyCode);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async syncData(barcode: string, verifyCode: string) {
    const loading = await this.loadingCtrl.create({ message: '匯入中...' });
    await loading.present();
    try {
      const today = new Date();
      const last  = new Date();
      last.setMonth(today.getMonth() - 1);
      const fmtSlash = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '/');

      const invoices = await this.invoiceService.syncInvoices(
        barcode, verifyCode, fmtSlash(last), fmtSlash(today)
      );

      if (!invoices || invoices.length === 0) {
        await loading.dismiss();
        await this.showAlert('沒有發票', '這段時間沒有可匯入的發票');
        return;
      }

      const defaultCat = this.categories.find(c => c.type === 'expense');
      if (!defaultCat) {
        await loading.dismiss();
        await this.showAlert('尚無分類', '請先到「分類管理」建立至少一個支出分類再匯入');
        return;
      }

      const rows = invoices.map(inv => ({
        date: this.toDateOnly(inv.invDate),
        description: inv.sellerName || '發票消費',
        amount: Number(inv.amount) || 0,
        category_id: defaultCat.id,
        type: 'expense' as const,
        spender: this.defaultSpender,
        source: 'invoice' as const,
        invoice_num: inv.invNum,
      }));

      const result = await this.budgetService.addTransactionsBulk(rows);
      await loading.dismiss();
      this.toast(`匯入完成:新增 ${result.inserted} 筆 / 跳過重複 ${result.skipped} 筆`);
    } catch (error: any) {
      await loading.dismiss();
      await this.showAlert('匯入失敗', error?.message || '連線異常');
    }
  }

  // 把財政部 "2023/10/20" 轉成 Postgres date 格式 'YYYY-MM-DD'
  private toDateOnly(s: string): string {
    if (!s) return this.todayDate();
    const [y, m, d] = s.split('/').map(Number);
    if (!y || !m || !d) return this.todayDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  private todayDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // ===== 通用 =====
  goCategories() { this.router.navigate(['/settings/categories']); }

  async signOut() {
    await this.auth.signOut();
    this.router.navigate(['/login']);
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 1800, position: 'bottom' });
    t.present();
  }

  private async showAlert(header: string, message: string) {
    const a = await this.alertCtrl.create({ header, message, buttons: ['好'] });
    await a.present();
  }
}
