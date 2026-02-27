import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonInput, IonButton, IonContent, IonDatetime, IonDatetimeButton, IonModal, IonIcon,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  add, wallet, leaf, calendarOutline, createOutline,
  cashOutline, leafOutline, scanOutline, cloudDownloadOutline
} from 'ionicons/icons';
import { CapacitorHttp } from '@capacitor/core';

import { BudgetService } from '../services/budget.service';
import { Transaction, BudgetCategory, Category } from '../models/transaction.model';
import { InvoiceService } from '../services/invoice.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonInput, IonDatetime, IonDatetimeButton, IonModal, IonButton, IonIcon
  ],
})

export class HomePage implements OnInit {
  // 注入 Services
  private budgetService = inject(BudgetService);
  private invoiceService = inject(InvoiceService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  // private categoryService = inject(CategoryService);

  // 畫面上的交易列表
  transactions: Transaction[] = [];

  // 計算總支出
  totalExpense = 0;

  // 新增表單的欄位變數
  newDate: string = new Date().toISOString(); // 預設今天
  newDesc: string = '';
  newAmount: number | null = null;
  newCategory: BudgetCategory = 'Needs'; // 這裡使用的是 model 裡的型別
  newSpender: string = 'Dad';

  currentType = 'expense';

  categories: Category[] = [
    { id: 'Needs', name: '必要支出', icon: 'wallet', type: 'expense' },
    { id: 'Wants', name: '想要支出', icon: 'leaf', type: 'expense' },
    { id: 'Savings', name: '存錢', icon: 'leaf', type: 'expense' }
  ];

  constructor() {
    addIcons({ // 註冊我們會用到的圖示
      add, wallet, leaf, calendarOutline, createOutline,
      cashOutline, leafOutline, scanOutline, cloudDownloadOutline
    });
  }

  // 當畫面開啟時，執行載入
  async ngOnInit() {
    await this.loadData();
  }

  // 從 Service 載入資料
  async loadData() {
    this.transactions = await this.budgetService.getTransactions();
    // 簡單計算總額
    this.totalExpense = this.transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  // 按下「記一筆」按鈕
  async add() {
    if (!this.newDesc || !this.newAmount) {
      this.showAlert('欄位未填', '請輸入項目和金額喔！');
      return;
    }

    const newTx: Transaction = {
      date: this.newDate,
      description: this.newDesc,
      amount: this.newAmount,
      category: this.newCategory,
      spender: this.newSpender
    };

    // 呼叫 Service 寫入資料庫
    await this.budgetService.addTransaction(newTx);

    // 重新載入列表與清空輸入框
    await this.loadData();
    this.newDesc = '';
    this.newAmount = null;

    // 顯示成功訊息
    const toast = await this.toastCtrl.create({
      message: '記帳成功！',
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  // ✨ 功能：開啟載入發票視窗
  async openSyncModal() {
    const alert = await this.alertCtrl.create({
      header: '載入載具發票',
      subHeader: '請輸入手機條碼與驗證碼',
      inputs: [
        {
          name: 'barcode',
          type: 'text',
          placeholder: '手機條碼 (例如 /ABC+123)',
          value: localStorage.getItem('user_barcode') || ''
        },
        {
          name: 'verifyCode',
          type: 'password',
          placeholder: '載具驗證碼 (密碼)'
        }
      ],
      buttons: [
        { text: '取消', role: 'cancel' },
        {
          text: '載入',
          handler: async (data) => {
            if (data.barcode && data.verifyCode) {
              localStorage.setItem('user_barcode', data.barcode);
              await this.syncData(data.barcode, data.verifyCode);
            } else {
              // 這裡呼叫 helper 方法顯示錯誤
              await this.showAlert('資料不全', '請輸入完整的條碼與驗證碼');
            }
          }
        }
      ],
      cssClass: 'baby-alert'
    });
    await alert.present();
  }

  // 執行同步動作
  async syncData(barcode: string, verifyCode: string) {
    const loading = await this.alertCtrl.create({ header: '載入中...', buttons: [] });
    await loading.present();

    try {
      const today = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(today.getMonth() - 1);

      const fmtDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '/');

      // 呼叫 Service
      const invoices = await this.invoiceService.syncInvoices(
        barcode,
        verifyCode,
        fmtDate(lastMonth),
        fmtDate(today)
      );

      loading.dismiss();

      if (invoices && invoices.length > 0) {
        const latest = invoices[0];

        this.newAmount = latest.amount;
        this.newDesc = `${latest.sellerName} (發票${latest.invNum})`;
        this.newDate = new Date(latest.invDate).toISOString();

        await this.showAlert('載入成功', `成功抓到 ${invoices.length} 筆發票！\n已為您填入最近一筆：${latest.sellerName}`);
      } else {
        await this.showAlert('無新資料', '這段時間內沒有找到發票紀錄喔');
      }

    } catch (error) {
      loading.dismiss();
      console.error(error);
      await this.showAlert('同步失敗', '請檢查驗證碼是否正確，或稍後再試');
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['好']
    });
    await alert.present();
  }
}
