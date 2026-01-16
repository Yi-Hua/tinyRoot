import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonInput, IonButton, IonIcon, IonItem } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router'; // 用來跳轉頁面
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonInput, IonButton, IonIcon, IonItem, CommonModule, FormsModule]
})
export class LoginPage {
  email = '';
  password = '';
  errorMessage = '';

  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({ mailOutline, lockClosedOutline });
  }

  // 登入
  async handleLogin() {
    try {
      this.errorMessage = ''; // 清空錯誤
      await this.authService.signIn(this.email, this.password);
      // 登入成功，跳轉回首頁
      this.router.navigate(['/home']);
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  // 註冊
  async handleRegister() {
    try {
      this.errorMessage = '';
      await this.authService.signUp(this.email, this.password);
      alert('註冊成功！請直接登入 (如果沒關驗證信，請先去信箱收信)');
      // 這裡可以選擇直接登入，或讓使用者自己按登入
      await this.handleLogin();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }
}
