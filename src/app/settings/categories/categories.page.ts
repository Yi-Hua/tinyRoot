import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel,
  IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircle, reorderTwoOutline, trashOutline, leafOutline } from 'ionicons/icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CategoryService, Category } from 'src/app/services/category.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonBackButton, IonButton, IonIcon,
    IonSegment, IonSegmentButton, IonLabel,
    IonList, IonItem, IonItemSliding, IonItemOptions, IonItemOption
  ]
})
export class CategoriesPage implements OnInit {
  currentType: 'expense' | 'income' = 'expense';
  categories: Category[] = [];

  private categoryService = inject(CategoryService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ addCircle, reorderTwoOutline, trashOutline, leafOutline });
  }

  ngOnInit() {
    this.categoryService.categories$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.categories = data);
  }

  get filteredCategories() {
    return this.categories.filter(c => c.type === this.currentType);
  }

  segmentChanged() {}

  async openAddModal() {
    const alert = await this.alertCtrl.create({
      header: '新增分類',
      subHeader: this.currentType === 'expense' ? '新增支出類別' : '新增收入類別',
      inputs: [
        { name: 'icon', type: 'text', placeholder: '一個 Emoji(例如 🍔)', attributes: { maxlength: 2 } },
        { name: 'name', type: 'text', placeholder: '分類名稱(例如:奶粉尿布)' }
      ],
      buttons: [
        { text: '取消', role: 'cancel', cssClass: 'secondary' },
        {
          text: '新增',
          handler: async (data) => {
            if (!data?.name || !data?.icon) {
              this.showToast('請填 emoji 和名稱');
              return false;
            }
            try {
              await this.categoryService.addCategory(data.name, data.icon, this.currentType);
              this.showToast(`已新增:${data.icon} ${data.name}`);
              return true;
            } catch (e: any) {
              this.showToast('新增失敗:' + (e?.message || ''));
              return false;
            }
          }
        }
      ],
      cssClass: 'baby-alert'
    });
    await alert.present();
  }

  async deleteCategory(id: string) {
    try {
      await this.categoryService.deleteCategory(id);
      this.showToast('分類已刪除 🗑️');
    } catch (error: any) {
      console.error('刪除失敗', error);
      this.showToast('刪除失敗:' + (error?.message || '請稍後再試'));
    }
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      color: 'dark',
      position: 'bottom',
      cssClass: 'baby-toast'
    });
    toast.present();
  }
}
