import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircle, reorderTwoOutline, trashOutline, leafOutline } from 'ionicons/icons';

// 引入我們剛寫好的 Service
import { CategoryService, Category } from 'src/app/services/category.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class CategoriesPage implements OnInit {
  // 狀態變數
  currentType = 'expense'; // 目前選中的分頁 (預設支出)
  categories: Category[] = []; // 存放從資料庫抓回來的原始資料

  // 依賴注入 (Dependency Injection)
  private categoryService = inject(CategoryService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  constructor() {
    addIcons({ addCircle, reorderTwoOutline, trashOutline, leafOutline });
  }

  ngOnInit() {
    // 1. 訂閱資料流
    this.categoryService.categories$.subscribe((data) => {
      this.categories = data;
    });

    // 2. 觸發載入
    this.categoryService.loadCategories();
  }

  // Getter: 自動篩選資料
  get filteredCategories() {
    return this.categories.filter(c => c.type === this.currentType);
  }

  // 切換 Segment 時觸發
  segmentChanged() {
    // 預留給震動回饋或其他效果
  }

  // ✨ 功能：新增分類
  async openAddModal() {
    const alert = await this.alertCtrl.create({
      header: '新增分類',
      subHeader: this.currentType === 'expense' ? '新增支出類別' : '新增收入類別',
      inputs: [
        {
          name: 'icon',
          type: 'text',
          placeholder: '輸入一個 Emoji (例如 🍔)',
          attributes: { maxlength: 2 }
        },
        {
          name: 'name',
          type: 'text',
          placeholder: '分類名稱 (例如: 買公仔)'
        }
      ],
      buttons: [
        { text: '取消', role: 'cancel', cssClass: 'secondary' },
        {
          text: '新增',
          handler: async (data) => {
            if (data.name && data.icon) {
              await this.categoryService.addCategory(data.name, data.icon, this.currentType);
              this.showToast(`已新增分類：${data.icon} ${data.name}`);
              return true; // 👈 補上這行！告訴程式「成功了，請關閉視窗」
            } else {
              return false; // 失敗/沒填寫，不關閉視窗
            }
          }
        }
      ],
      cssClass: 'baby-alert'
    });
    await alert.present();
  }

  // ✨ 功能：刪除分類
  async deleteCategory(id: string) {
    try {
      await this.categoryService.deleteCategory(id);
      this.showToast('分類已刪除 🗑️');
    } catch (error) {
      console.error('刪除失敗', error);
      this.showToast('刪除失敗，請稍後再試');
    }
  }

  // 小工具：顯示提示
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
