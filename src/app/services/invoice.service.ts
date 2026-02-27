import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';

// 定義發票資料結構
export interface CarrierInvoice {
  invNum: string;    // 發票號碼
  cardType: string;  // 載具類別 (3J0002 = 手機條碼)
  cardNo: string;    // 手機條碼 (/ABC+123)
  invDate: string;   // 日期 (20230101)
  amount: number;    // 金額
  sellerName: string;// 店家名稱
  status: string;    // 狀態
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  // ⚠️ 注意：這裡需要換成你向財政部申請的 AppID
  // 申請網址: https://www.einvoice.nat.gov.tw/APIMEMBERVAN/
  private appID = '你的_APP_ID_這裡_之後要去申請';
  private apiUrl = 'https://api.einvoice.nat.gov.tw/PB2CAPIVAN/invServ/InvServ';

  constructor() { }

  /**
   * 雲端載入發票 (查詢發票明細)
   * @param barcode 手機條碼 (例如 /ABC+123)
   * @param verifyCode 驗證碼 (密碼)
   * @param startDate 開始日期 (YYYY/MM/DD)
   * @param endDate 結束日期 (YYYY/MM/DD)
   */
  async syncInvoices(barcode: string, verifyCode: string, startDate: string, endDate: string) {

    // 如果還沒申請 API，我們先回傳假資料測試 UI
    if (this.appID === '你的_APP_ID_這裡_之後要去申請') {
      console.warn('尚未設定 AppID，回傳測試資料');
      // 模擬一點網路延遲，讓 Loading 轉一下感覺比較真實
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.getMockData();
    }

    try {
      // 準備發送給財政部的參數
      const options = {
        url: this.apiUrl,
        params: {
          version: '0.5',
          cardType: '3J0002', // 手機條碼固定代號
          cardNo: barcode,
          expTimeStamp: '2147483647',
          action: 'carrierInvChk',
          timeStamp: new Date().getTime().toString(),
          startDate: startDate, // 格式 2023/01/01
          endDate: endDate,
          onlyWinningInv: 'N', // N=全部, Y=只抓中獎
          uuid: 'tiny_root_app', // 隨意唯一碼
          appID: this.appID,
          verifyCode: verifyCode // 載具密碼
        }
      };

      // 使用 Native HTTP 發送請求
      // 這能解決 CORS (跨域) 問題，非常適合手機 App 開發
      const response = await CapacitorHttp.post(options);

      if (response.status === 200 && response.data && response.data.code === 200) {
        return response.data.details; // 這是真實資料
      } else {
        // 財政部 API 有時會回傳 200 但內容是錯誤訊息，這裡做個簡單判斷
        throw new Error(response.data?.msg || '連線失敗或參數錯誤');
      }

    } catch (error) {
      console.error('API 呼叫錯誤', error);
      throw error;
    }
  }

  // 🌱 測試用的假資料 (讓你先看到效果)
  private getMockData(): CarrierInvoice[] {
    return [
      {
        invNum: 'AB-12345678',
        cardType: '3J0002',
        cardNo: '/ABC1234',
        invDate: '2023/10/20',
        amount: 150,
        sellerName: '統一超商',
        status: '已確認'
      },
      {
        invNum: 'CD-87654321',
        cardType: '3J0002',
        cardNo: '/ABC1234',
        invDate: '2023/10/21',
        amount: 580,
        sellerName: '全聯福利中心',
        status: '已確認'
      }
    ];
  }
}
