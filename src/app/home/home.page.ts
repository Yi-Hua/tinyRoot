import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonInput, IonButton, IonContent, IonDatetime, IonDatetimeButton, IonModal,
  IonIcon, IonFab, IonFabButton, IonNote, // 補上遺失的元件
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, wallet, leaf, calendarOutline, createOutline,
  cashOutline, leafOutline, scanOutline, cloudDownloadOutline,
  chevronDownOutline // 補上 HTML 用到的圖示
} from 'ionicons/icons';

import { BudgetService } from '../services/budget.service';
import { Transaction, BudgetCategory } from '../models/transaction.model';
import { InvoiceService } from '../services/invoice.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonInput, IonDatetime, IonDatetimeButton, IonModal,
    IonButton, IonIcon, IonFab, IonFabButton, IonNote // 這裡也要同步匯入
  ],
})
export class HomePage implements OnInit {
  private budgetService = inject(BudgetService);
  private invoiceService = inject(InvoiceService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  transactions: Transaction[] = [];
  totalExpense = 0;

  // 新增育兒分類體系
  public appCategories = [
    { id: 'baby_daily', name: '寶貝日常', emoji: '🍼' },
    { id: 'education', name: '教育成長', emoji: '📚' },
    { id: 'health', name: '醫療保健', emoji: '🏥' },
    { id: 'family', name: '家庭生活', emoji: '🏠' },
    { id: 'self_care', name: '自我愛護', emoji: '☕️' }
  ];

  newDate: string = new Date().toISOString();
  newDesc: string = '';
  newAmount: number | null = null;
  newCategory: string = 'baby_daily'; // 修改為預設育兒分類
  newSpender: string = 'Dad';

  constructor() {
    addIcons({
      add, wallet, leaf, calendarOutline, createOutline,
      cashOutline, leafOutline, scanOutline, cloudDownloadOutline,
      chevronDownOutline
    });
  }

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    this.transactions = await this.budgetService.getTransactions();
    this.totalExpense = this.transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  // ✨ 修復：HTML 裡呼叫的 getEmoji
  getEmoji(categoryId: string): string {
    const cat = this.appCategories.find(c => c.id === categoryId);
    return cat ? cat.emoji : '🌱';
  }

  // ✨ 修復：HTML 裡呼叫的切換帳本功能
  async openLedgerPicker() {
    const alert = await this.alertCtrl.create({
      header: '切換帳本',
      buttons: ['確定']
    });
    await alert.present();
  }

  // ✨ 修復：HTML 裡呼叫的開啟新增視窗 (先用原本的 syncModal 替代或跳出 Alert)
  async openAddModal() {
    // 暫時導向妳原本的載具載入，或者妳可以這裡寫開啟 Modal 的邏輯
    await this.openSyncModal();
  }

  // 原本的記帳邏輯
  async add() {
    if (!this.newDesc || !this.newAmount) {
      this.showAlert('欄位未填', '請輸入項目和金額喔！');
      return;
    }

    const newTx: any = { // 暫時用 any 避免跟舊的 Model 型別衝突
      date: this.newDate,
      description: this.newDesc,
      amount: this.newAmount,
      category: this.newCategory,
      spender: this.newSpender
    };

    await this.budgetService.addTransaction(newTx);
    await this.loadData();
    this.newDesc = '';
    this.newAmount = null;

    const toast = await this.toastCtrl.create({
      message: '記帳成功！',
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  // 妳原本的載具同步邏輯 (保留不變)
  async openSyncModal() {
    const alert = await this.alertCtrl.create({
      header: '載入載具發票',
      inputs: [
        { name: 'barcode', type: 'text', placeholder: '手機條碼', value: localStorage.getItem('user_barcode') || '' },
        { name: 'verifyCode', type: 'password', placeholder: '驗證碼' }
      ],
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '載入',
          handler: async (data) => {
            if (data.barcode && data.verifyCode) {
              localStorage.setItem('user_barcode', data.barcode);
              await this.syncData(data.barcode, data.verifyCode);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async syncData(barcode: string, verifyCode: string) {
    const loading = await this.alertCtrl.create({ header: '載入中...', buttons: [] });
    await loading.present();
    try {
      const today = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(today.getMonth() - 1);
      const fmtDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '/');

      const invoices = await this.invoiceService.syncInvoices(barcode, verifyCode, fmtDate(lastMonth), fmtDate(today));
      loading.dismiss();

      if (invoices && invoices.length > 0) {
        const latest = invoices[0];
        this.newAmount = latest.amount;
        this.newDesc = `${latest.sellerName}`;
        this.newDate = new Date(latest.invDate).toISOString();
        await this.showAlert('載入成功', `已填入最近一筆：${latest.sellerName}`);
      }
    } catch (error) {
      loading.dismiss();
      await this.showAlert('同步失敗', '連線異常');
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({ header, message, buttons: ['好'] });
    await alert.present();
  }
}
