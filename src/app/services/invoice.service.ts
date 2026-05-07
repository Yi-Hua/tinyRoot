import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { environment } from 'src/environments/environment';

// 定義發票資料結構
export interface CarrierInvoice {
  invNum: string;    // 發票號碼
  cardType: string;  // 載具類別 (3J0002 = 手機條碼)
  cardNo: string;    // 手機條碼 (/ABC+123)
  invDate: string;   // 日期 (YYYY/MM/DD)
  amount: number;    // 金額
  sellerName: string;// 店家名稱
  status: string;    // 狀態
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  // 申請網址:https://www.einvoice.nat.gov.tw/APIMEMBERVAN/
  private appID = environment.einvoice?.appId || '';
  private apiUrl = 'https://api.einvoice.nat.gov.tw/PB2CAPIVAN/invServ/InvServ';

  constructor() { }

  /**
   * 雲端載入發票 (查詢發票明細)
   * @param barcode 手機條碼 (例如 /ABC+123)
   * @param verifyCode 驗證碼 (密碼)
   * @param startDate 開始日期 (YYYY/MM/DD)
   * @param endDate 結束日期 (YYYY/MM/DD)
   */
  async syncInvoices(
    barcode: string,
    verifyCode: string,
    startDate: string,
    endDate: string
  ): Promise<CarrierInvoice[]> {

    // 還沒申請 API → 回傳測試假資料
    if (!this.appID) {
      console.warn('尚未設定 einvoice.appId,回傳測試資料');
      await new Promise(resolve => setTimeout(resolve, 800));
      return this.getMockData();
    }

    try {
      const options = {
        url: this.apiUrl,
        params: {
          version: '0.5',
          cardType: '3J0002', // 手機條碼固定代號
          cardNo: barcode,
          expTimeStamp: '2147483647',
          action: 'carrierInvChk',
          timeStamp: new Date().getTime().toString(),
          startDate,
          endDate,
          onlyWinningInv: 'N',
          uuid: 'tiny_root_app',
          appID: this.appID,
          verifyCode
        }
      };

      // 用 Native HTTP 解決 CORS,適合手機 App
      const response = await CapacitorHttp.post(options);

      if (response.status === 200 && response.data && response.data.code === 200) {
        return (response.data.details ?? []) as CarrierInvoice[];
      } else {
        throw new Error(response.data?.msg || '連線失敗或參數錯誤');
      }
    } catch (error) {
      console.error('API 呼叫錯誤', error);
      throw error;
    }
  }

  // 🌱 測試用假資料
  private getMockData(): CarrierInvoice[] {
    const today = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    return [
      { invNum: 'AB-12345678', cardType: '3J0002', cardNo: '/ABC1234', invDate: fmt(today), amount: 150, sellerName: '統一超商', status: '已確認' },
      { invNum: 'CD-87654321', cardType: '3J0002', cardNo: '/ABC1234', invDate: fmt(today), amount: 580, sellerName: '全聯福利中心', status: '已確認' },
      { invNum: 'EF-11223344', cardType: '3J0002', cardNo: '/ABC1234', invDate: fmt(today), amount: 1280, sellerName: '寶寶王國', status: '已確認' },
    ];
  }
}
