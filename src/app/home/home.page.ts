import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonInput, IonSelect, IonSelectOption,
  IonButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonBadge,
  IonDatetime, IonDatetimeButton, IonModal
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, wallet, leaf, calendarOutline, createOutline, cashOutline, leafOutline } from 'ionicons/icons';
import { BudgetService } from '../services/budget.service';
import { Transaction, BudgetCategory } from '../models/transaction.model';
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonInput, IonSelect, IonSelectOption,
    IonDatetime, IonDatetimeButton, IonModal,
    IonButton, IonLabel, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonBadge
  ],
})
export class HomePage implements OnInit {
  private budgetService = inject(BudgetService);

  // 畫面上的交易列表
  transactions: Transaction[] = [];

  // 計算總支出
  totalExpense = 0;

  // 新增表單的欄位變數
  newDate: string = new Date().toISOString(); // 預設今天
  newDesc: string = '';
  newAmount: number | null = null;
  newCategory: BudgetCategory = 'Needs';
  newSpender: string = 'Dad';

  constructor() {
    // 註冊我們會用到的圖示
    addIcons({ add, wallet, leaf, calendarOutline, createOutline, cashOutline, leafOutline });
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
      alert('請輸入項目和金額喔！');
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
  }
}
