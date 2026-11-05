'use client';

import { Printer } from 'lucide-react';
import type { Room, Account } from '@/lib/types';
import DailyReportPrint from './DailyReportPrint';

interface ReportScreenProps {
  rooms: Room[];
  /** Người đang đăng nhập — in ở mục "Người lập" của báo cáo */
  account?: Account | null;
}

/* =========================================================================
   MÀN DAILY REPORT — dùng CHUNG 1 thiết kế với bản in / tải PDF (DailyReportPrint).
   Trên màn hình: ẩn "Lịch sử giám sát kiểm phòng" + chữ ký (đã có ở màn Nhiệm vụ).
   Khi bấm IN BÁO CÁO: in đúng tờ báo cáo này, khổ A4 ngang, có thêm 2 phần trên.
   ========================================================================= */
export default function ReportScreen({ rooms, account }: ReportScreenProps) {
  // Đặt sẵn tên file "HK_Daily_Report_dd-mm-yyyy" -> chọn "Lưu dưới dạng PDF" để tải về
  const handlePrint = () => {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const oldTitle = document.title;
    document.title = `HK_Daily_Report_${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
    const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 50);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
        <h1 className="text-[19px] font-bold">Daily Report</h1>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2"
        >
          <Printer className="w-3.5 h-3.5" /> IN BÁO CÁO
        </button>
      </div>

      <DailyReportPrint rooms={rooms} account={account} />
    </div>
  );
}
