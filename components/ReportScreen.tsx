'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, Save, Search, ArrowLeft, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Room, Account } from '@/lib/types';
import DailyReportPrint from './DailyReportPrint';
import {
  saveTodayReport, getArchiveInfo, listArchive, getSnapshot, searchRoomHistory,
  vnDateKey, vnHour, keyToDMY,
  type ArchiveRow, type DailySnapshot, type RoomDayRecord,
} from '@/lib/dailyArchive';
import { displayLabel, PM_MOVE_ACTION } from '@/lib/assignHelpers';
import { formatTimeOnly } from '@/lib/roomStyles';

interface ReportScreenProps {
  rooms: Room[];
  /** Người đang đăng nhập — in ở mục "Người lập" của báo cáo */
  account?: Account | null;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const addDays = (key: string, n: number) => {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const savedTimeLabel = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/* =========================================================================
   MÀN DAILY REPORT — dùng CHUNG 1 thiết kế với bản in / tải PDF (DailyReportPrint).
   Thanh nút: [LƯU TỰ ĐỘNG] [TÌM KHOẢNG NGÀY] [IN BÁO CÁO]
   - Lưu tự động: báo cáo tự lưu vào Kho lúc 23:00 mỗi ngày (Vercel Cron) + app tự lưu dự phòng
     nếu đang mở sau 23:00 mà chưa có bản tự lưu; bấm nút để xem trạng thái hoặc "Lưu ngay".
   - Tìm khoảng ngày: mở Kho báo cáo — danh sách ngày đã lưu, hoặc lịch sử 1 phòng qua các ngày.
   ========================================================================= */
export default function ReportScreen({ rooms, account }: ReportScreenProps) {
  const [view, setView] = useState<'today' | 'archive'>('today');
  const [viewing, setViewing] = useState<DailySnapshot | null>(null);

  /* ---------- Lưu tự động ---------- */
  const [todayInfo, setTodayInfo] = useState<ArchiveRow | null>(null);
  const [infoError, setInfoError] = useState('');
  const [showSavePanel, setShowSavePanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const autoTriedRef = useRef(false);

  const refreshTodayInfo = useCallback(async () => {
    try {
      const info = await getArchiveInfo(vnDateKey());
      setTodayInfo(info);
      setInfoError('');
      return info;
    } catch (e: any) {
      setInfoError(e?.message || 'Không đọc được Kho báo cáo');
      return undefined;
    }
  }, []);

  const saveNow = async (isAuto: boolean) => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await saveTodayReport(isAuto ? 'Tự động 23:00' : account?.hoTen || 'Giám sát', isAuto);
      if (!res.success) setSaveMsg('Lưu không được: ' + (res.error || 'lỗi không rõ'));
      else setSaveMsg(isAuto ? '' : 'Đã lưu báo cáo hôm nay vào Kho');
      await refreshTodayInfo();
    } catch (e: any) {
      setSaveMsg('Lưu không được: ' + (e?.message || 'lỗi mạng'));
    } finally {
      setSaving(false);
    }
  };

  // Dự phòng: app đang mở sau 23:00 mà hôm nay chưa có bản tự lưu -> tự lưu luôn
  useEffect(() => {
    const check = async () => {
      const info = await refreshTodayInfo();
      if (info === undefined || autoTriedRef.current) return;
      if (vnHour() >= 23 && !(info && info.isAuto)) {
        autoTriedRef.current = true;
        saveNow(true);
      }
    };
    check();
    const t = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Tìm khoảng ngày ---------- */
  const today = vnDateKey();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [roomQuery, setRoomQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [dayRows, setDayRows] = useState<ArchiveRow[] | null>(null);
  const [roomRows, setRoomRows] = useState<RoomDayRecord[] | null>(null);
  const [searchedRoom, setSearchedRoom] = useState('');
  const [opening, setOpening] = useState('');

  const runSearch = async () => {
    if (!from || !to) return;
    setSearching(true);
    setSearchError('');
    const lo = from <= to ? from : to;
    const hi = from <= to ? to : from;
    try {
      const room = roomQuery.trim();
      if (room) {
        setRoomRows(await searchRoomHistory(lo, hi, room));
        setSearchedRoom(room);
        setDayRows(null);
      } else {
        setDayRows(await listArchive(lo, hi));
        setRoomRows(null);
      }
    } catch (e: any) {
      setSearchError(e?.message || 'Không tìm được — kiểm tra mạng');
    } finally {
      setSearching(false);
    }
  };

  const openArchive = () => {
    setView('archive');
    setViewing(null);
    setShowSavePanel(false);
    if (!dayRows && !roomRows) runSearch();
  };

  const openDay = async (date: string) => {
    setOpening(date);
    try {
      const snap = await getSnapshot(date);
      if (snap) {
        setViewing(snap);
        window.scrollTo({ top: 0 });
      }
    } catch {
      setSearchError('Không mở được báo cáo ngày ' + keyToDMY(date));
    } finally {
      setOpening('');
    }
  };

  /* ---------- In ---------- */
  // Đặt sẵn tên file "HK_Daily_Report_dd-mm-yyyy" -> chọn "Lưu dưới dạng PDF" để tải về
  const handlePrint = () => {
    const key = viewing ? viewing.date : vnDateKey();
    const [y, m, d] = key.split('-');
    const oldTitle = document.title;
    document.title = `HK_Daily_Report_${d}-${m}-${y}`;
    const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 50);
  };

  const savedToday = !!todayInfo;
  const showSheet = view === 'today' || !!viewing;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap print:hidden">
        <h1 className="text-[19px] font-bold">Daily Report</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* LƯU TỰ ĐỘNG */}
          <div className="relative">
            <button
              onClick={() => setShowSavePanel((s) => !s)}
              className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 border ${
                savedToday ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-indigo-700 border-indigo-200 bg-indigo-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${infoError ? 'bg-red-500' : savedToday ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`} />
              <Save className="w-3.5 h-3.5" /> LƯU TỰ ĐỘNG
            </button>
            {showSavePanel && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSavePanel(false)} />
                <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-1.5 z-40 w-[280px] max-w-[calc(100vw-32px)] rounded-xl bg-white border border-slate-200 shadow-xl p-3.5 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-extrabold text-slate-800">Lưu tự động lúc 23:00</div>
                    <button onClick={() => setShowSavePanel(false)} className="text-slate-400" aria-label="Đóng"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                    Mỗi tối báo cáo được tự lưu vào Kho để tra lại về sau, kể cả khi không ai mở app. Lưu lại trong ngày sẽ ghi đè bản cũ.
                  </p>
                  <div className="mt-2.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2 text-[12px]">
                    {infoError ? (
                      <span className="flex items-start gap-1.5 text-red-600 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        Chưa kết nối được Kho báo cáo. Kiểm tra đã tạo bảng hkpro_daily_reports trên Supabase chưa.
                      </span>
                    ) : todayInfo ? (
                      <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Hôm nay đã lưu lúc {savedTimeLabel(todayInfo.savedAt)} · {todayInfo.isAuto ? 'tự động' : todayInfo.savedBy}
                      </span>
                    ) : (
                      <span className="text-slate-600 font-semibold">Hôm nay chưa lưu — sẽ tự lưu lúc 23:00</span>
                    )}
                  </div>
                  <button
                    onClick={() => saveNow(false)}
                    disabled={saving}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-extrabold text-white bg-indigo-600 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? 'Đang lưu...' : 'Lưu ngay bây giờ'}
                  </button>
                  {saveMsg && <div className={`mt-2 text-[11.5px] font-semibold ${saveMsg.startsWith('Đã') ? 'text-emerald-600' : 'text-red-600'}`}>{saveMsg}</div>}
                </div>
              </>
            )}
          </div>

          {/* TÌM KHOẢNG NGÀY */}
          <button
            onClick={() => (view === 'archive' && !viewing ? setView('today') : openArchive())}
            className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 border ${
              view === 'archive' ? 'text-white bg-slate-800 border-slate-800' : 'text-slate-700 border-slate-200 bg-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" /> TÌM KHOẢNG NGÀY
          </button>

          <button
            onClick={handlePrint}
            disabled={view === 'archive' && !viewing}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2 disabled:opacity-40"
          >
            <Printer className="w-3.5 h-3.5" /> IN BÁO CÁO
          </button>
        </div>
      </div>

      {/* Đang xem 1 bản đã lưu */}
      {viewing && (
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 print:hidden">
          <button onClick={() => setViewing(null)} className="flex items-center gap-1 text-xs font-bold text-indigo-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại kết quả tìm
          </button>
          <span className="text-[12px] text-indigo-800">
            Đang xem báo cáo đã lưu ngày <b>{keyToDMY(viewing.date)}</b> · lưu lúc {savedTimeLabel(viewing.exportedAt)} ({viewing.by})
          </span>
          <button onClick={() => { setViewing(null); setView('today'); }} className="text-xs font-bold text-slate-600 underline">
            Về báo cáo hôm nay
          </button>
        </div>
      )}

      {/* KHO BÁO CÁO */}
      {view === 'archive' && !viewing && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden print:hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
            <div className="text-[13px] font-extrabold text-slate-800 mb-2.5">Kho báo cáo · tìm lại thông tin phòng</div>
            <form
              onSubmit={(e) => { e.preventDefault(); runSearch(); }}
              className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_150px_auto] gap-2 items-end"
            >
              <label className="text-[11px] font-bold text-slate-500">Từ ngày
                <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white" />
              </label>
              <label className="text-[11px] font-bold text-slate-500">Đến ngày
                <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white" />
              </label>
              <label className="text-[11px] font-bold text-slate-500">Số phòng (tuỳ chọn)
                <input value={roomQuery} onChange={(e) => setRoomQuery(e.target.value)} placeholder="VD 605" inputMode="numeric" className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white" />
              </label>
              <button type="submit" disabled={searching} className="flex items-center justify-center gap-1.5 rounded-lg px-4 h-[34px] text-xs font-extrabold text-white bg-blue-600 disabled:opacity-50">
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Tìm
              </button>
            </form>
          </div>

          {searchError && <div className="px-3.5 py-3 text-[12px] font-semibold text-red-600">⚠ {searchError}</div>}

          {/* Danh sách ngày đã lưu */}
          {dayRows && (
            dayRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Không có báo cáo nào được lưu trong khoảng này.</div>
            ) : (
              <div>
                {dayRows.map((r, i) => {
                  const d = new Date(r.date + 'T00:00:00');
                  const sm = r.summary;
                  return (
                    <div key={r.date} className={`flex items-center gap-3 px-3.5 py-3 ${i ? 'border-t border-slate-100' : ''} hover:bg-slate-50`}>
                      <div className="w-12 text-center flex-shrink-0">
                        <div className="text-[10px] font-bold text-slate-400">{WEEKDAYS[d.getDay()]}</div>
                        <div className="text-[18px] font-extrabold tabular-nums leading-none">{r.date.slice(8, 10)}</div>
                        <div className="text-[10px] text-slate-400 tabular-nums">{r.date.slice(5, 7)}/{r.date.slice(0, 4)}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-800">Báo cáo ngày {keyToDMY(r.date)}</div>
                        {sm && (
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {sm.done}/{sm.total} phòng đã dọn · DND {sm.dnd} · RF {sm.rf}{sm.pm ? ` · PM Shift ${sm.pm} phòng` : ''}
                          </div>
                        )}
                      </div>
                      <span className={`hidden sm:inline-flex text-[10px] font-bold rounded-full px-2 py-[3px] border ${r.isAuto ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {r.isAuto ? `Tự lưu ${savedTimeLabel(r.savedAt)}` : `Lưu tay ${savedTimeLabel(r.savedAt)} · ${r.savedBy}`}
                      </span>
                      <button
                        onClick={() => openDay(r.date)}
                        disabled={opening === r.date}
                        className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-blue-700 border border-blue-200 bg-blue-50 flex-shrink-0 disabled:opacity-50"
                      >
                        {opening === r.date ? 'Đang mở...' : 'Xem'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Lịch sử 1 phòng */}
          {roomRows && (
            roomRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">Không tìm thấy phòng {searchedRoom} trong các báo cáo đã lưu của khoảng này.</div>
            ) : (
              <div>
                <div className="px-3.5 pt-3 text-[12px] font-bold text-slate-600">
                  Lịch sử phòng <span className="text-blue-700">{searchedRoom}</span> · {roomRows.length} ngày
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px] mt-2 min-w-[720px]">
                    <thead>
                      <tr className="text-[10px] font-extrabold tracking-[0.08em] uppercase text-slate-500 bg-slate-50 border-y border-slate-100">
                        <th className="px-3.5 py-2 text-left">Ngày</th>
                        <th className="px-2 py-2 text-left">FO</th>
                        <th className="px-2 py-2 text-left">Tình trạng</th>
                        <th className="px-2 py-2 text-left">Nhân viên</th>
                        <th className="px-2 py-2 text-left">Giờ dọn</th>
                        <th className="px-2 py-2 text-left">DND / RF / PM</th>
                        <th className="px-2 py-2 text-left">Giám sát VCI</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {roomRows.map((rec, i) => {
                        const r = rec.room;
                        const times = (act: string) => rec.history.filter((h) => h.hanhDong === act).map((h) => formatTimeOnly(h.gio)).filter(Boolean);
                        const dnd = times('DND Bật');
                        const rf = times('Từ chối (RF)');
                        const pm = rec.history.filter((h) => h.hanhDong === PM_MOVE_ACTION);
                        const vci = [...rec.inspections].reverse().filter((l) => l.endTime && l.status === 'Đã kiểm tra').pop();
                        const st = r.TaskStatus === 'Hoàn thành'
                          ? { t: 'Đã dọn', c: 'bg-emerald-50 text-emerald-700' }
                          : r.TaskStatus === 'DND' ? { t: 'DND', c: 'bg-red-50 text-red-700' }
                          : r.TaskStatus === 'Refused' ? { t: 'Refused', c: 'bg-purple-50 text-purple-700' }
                          : r.HkStatus === 'Phòng sửa chữa (OOO)' ? { t: 'OOO', c: 'bg-slate-100 text-slate-500' }
                          : { t: r.TaskStatus || r.HkStatus, c: 'bg-slate-100 text-slate-600' };
                        return (
                          <tr key={rec.date} className={`${i ? 'border-t border-slate-100' : ''} align-top`}>
                            <td className="px-3.5 py-2.5 font-bold tabular-nums whitespace-nowrap">{keyToDMY(rec.date)}</td>
                            <td className="px-2 py-2.5 text-slate-500 whitespace-nowrap">{r.FoStatus || '—'}</td>
                            <td className="px-2 py-2.5"><span className={`text-[10.5px] font-bold rounded-full px-2 py-[2px] whitespace-nowrap ${st.c}`}>{st.t}</span></td>
                            <td className="px-2 py-2.5 text-slate-700 whitespace-nowrap">{r.NhanVienPhuTrach ? displayLabel(r.NhanVienPhuTrach) : '—'}</td>
                            <td className="px-2 py-2.5 tabular-nums text-slate-600 whitespace-nowrap">
                              {r.StartTime && r.TaskStatus !== 'Refused' ? `${formatTimeOnly(r.StartTime)} → ${r.EndTime ? formatTimeOnly(r.EndTime) : '...'}` : '—'}
                              {r.Duration && r.TaskStatus === 'Hoàn thành' ? <span className="text-slate-400"> · {r.Duration}&apos;</span> : null}
                            </td>
                            <td className="px-2 py-2.5 text-[11px] text-slate-600">
                              {dnd.length > 0 && <div><b className="text-red-600">DND</b> ×{dnd.length}: {dnd.join(', ')}</div>}
                              {rf.length > 0 && <div><b className="text-purple-700">RF</b> ×{rf.length}: {rf.join(', ')}</div>}
                              {pm.map((h, j) => <div key={j}><b className="text-indigo-700">→ PM</b> {formatTimeOnly(h.gio)}{h.chiTiet ? ` (${h.chiTiet})` : ''}</div>)}
                              {dnd.length === 0 && rf.length === 0 && pm.length === 0 && '—'}
                            </td>
                            <td className="px-2 py-2.5 text-slate-600 whitespace-nowrap">{vci ? vci.giamSat : '—'}</td>
                            <td className="px-2 py-2.5">
                              <button onClick={() => openDay(rec.date)} className="text-[11px] font-bold text-blue-700 whitespace-nowrap">
                                {opening === rec.date ? 'Đang mở...' : 'Xem ngày'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {showSheet && <DailyReportPrint rooms={rooms} account={account} snapshot={viewing} />}
    </div>
  );
}
