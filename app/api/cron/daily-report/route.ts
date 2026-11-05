import { NextRequest, NextResponse } from 'next/server';
import { saveTodayReport, vnDateKey } from '@/lib/dailyArchive';

/* TỰ ĐỘNG LƯU DAILY REPORT LÚC 23:00 (giờ VN) — Vercel Cron gọi route này mỗi ngày
   (lịch trong vercel.json: "0 16 * * *" = 16:00 UTC = 23:00 VN; gói miễn phí chạy trong khoảng 23:00–23:59).
   Nếu có đặt biến môi trường CRON_SECRET trên Vercel thì chỉ Cron của Vercel gọi được. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const res = await saveTodayReport('Tự động 23:00', true);
    return NextResponse.json({ ok: res.success, date: vnDateKey(), error: res.error });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500 });
  }
}
