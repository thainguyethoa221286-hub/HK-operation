'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Clock3, AlertCircle, Printer, KeyRound, MessageSquareText, MessageSquareWarning, ListChecks } from 'lucide-react';
import type { Room, KeyLog, HistoryEntry } from '@/lib/types';
import { getKeyLogs, getTodayHistory } from '@/lib/api';
import { stripCodesFromNote, formatDateShort, formatTimeOnly, combineNotes, extractNoteCodes } from '@/lib/roomStyles';
import KeyBoard from './KeyBoard';

interface ReportScreenProps {
  rooms: Room[];
}

/** Tổng số phút từ danh sách Duration dạng chuỗi (bỏ qua giá trị rỗng/không hợp lệ) */
function sumDuration(rooms: Room[]): number {
  return rooms.reduce((sum, r) => sum + (parseInt(r.Duration, 10) || 0), 0);
}

/** Map HkStatus (tiếng Việt) -> badge chuẩn Tiếng Anh khách sạn cho HOUSEKEEPING DAILY REPORT */
const STATUS_BADGE_EN: Record<string, { label: string; cls: string }> = {
  'Phòng dơ': { label: 'DIRTY', cls: 'bg-red-100 text-red-600' },
  'Phòng đang dọn': { label: 'CLEANING', cls: 'bg-amber-100 text-amber-600' },
  'Phòng sạch': { label: 'CLEAN', cls: 'bg-blue-100 text-blue-600' },
  'Đã kiểm tra': { label: 'INSPECTED', cls: 'bg-emerald-100 text-emerald-600' },
  'Phòng sửa chữa (OOO)': { label: 'OOO', cls: 'bg-slate-100 text-slate-500' },
};
const CHECKING_BADGE = { label: 'CHECKING', cls: 'bg-amber-100 text-amber-600' };

function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] ${cls}`}>{label}</span>;
}

export default function ReportScreen({ rooms }: ReportScreenProps) {
  const [keyLogs, setKeyLogs] = useState<KeyLog[]>([]);
  // Lịch sử TRONG NGÀY của TẤT CẢ phòng — dùng riêng để liệt kê đủ MỌI lần bấm bật DND/RF
  // (mỗi lần bấm đã tự ghi 1 dòng mới trong tab "LichSuDon", không ghi đè) cho Daily Report.
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    getKeyLogs().then(setKeyLogs);
    const timer = setInterval(() => getKeyLogs().then(setKeyLogs), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    getTodayHistory().then(setHistory).catch(() => {});
    const timer = setInterval(() => getTodayHistory().then(setHistory).catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, []);

  // Mỗi lần nhân viên bấm BẬT DND/Từ chối (RF) trong ngày -> gom hết mốc giờ HH:mm theo từng phòng
  // (bấm mấy lần thì hiện đủ mấy mốc giờ, theo đúng thứ tự lúc bấm).
  const dndTimesByRoom = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of history) {
      if (h.hanhDong === 'DND Bật') {
        const t = formatTimeOnly(h.gio);
        if (t) (map[h.maPhong] ||= []).push(t);
      }
    }
    return map;
  }, [history]);
  const rfTimesByRoom = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of history) {
      if (h.hanhDong === 'Từ chối (RF)') {
        const t = formatTimeOnly(h.gio);
        if (t) (map[h.maPhong] ||= []).push(t);
      }
    }
    return map;
  }, [history]);

  // Mục "Ghi chú nhân viên" — CHỈ ở Báo cáo mới kết hợp ghi chú hiện tại + "hôm qua" (giữ đủ 1 ngày),
  // mọi nơi khác trong app (thẻ phòng, Modal...) chỉ dùng GhiChuNV/GhiChuAdmin hiện tại, xoá ngay khi sync.
  const staffNoteFor = (r: Room) => stripCodesFromNote(r.GhiChuNV) || stripCodesFromNote(r.GhiChuNVHomQua);
  const adminNoteFor = (r: Room) => r.GhiChuAdmin || r.GhiChuAdminHomQua;
  const staffNotedRooms = rooms.filter((r) => staffNoteFor(r));
  // Mục "Ghi chú giám sát" — toàn bộ ghi chú do Admin/Giám sát tự nhập (GhiChuAdmin), lưu trữ theo dõi
  const adminNotedRooms = rooms.filter((r) => adminNoteFor(r));
  // Danh sách đầy đủ 55 phòng, sắp theo số phòng tăng dần (102 -> 999)
  const allRoomsSorted = [...rooms].sort((a, b) => Number(a.MaPhong) - Number(b.MaPhong));
  // Ngày hôm nay (dd/mm/yyyy) cho tiêu đề báo cáo
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const total = rooms.length;
  const doneCount = rooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
  const dndCount = rooms.filter((r) => r.TaskStatus === 'DND').length;
  const rfCount = rooms.filter((r) => r.TaskStatus === 'Refused').length;

  const assignedRooms = rooms.filter((r) => r.NhanVienPhuTrach);
  const byStaff = assignedRooms.reduce<Record<string, Room[]>>((acc, r) => {
    (acc[r.NhanVienPhuTrach] = acc[r.NhanVienPhuTrach] || []).push(r);
    return acc;
  }, {});
  // Sắp xếp nhân viên theo % hoàn thành giảm dần — người làm nhiều/nhanh lên đầu
  const staffEntries = Object.entries(byStaff).sort((a, b) => {
    const pctA = a[1].filter((r) => r.TaskStatus === 'Hoàn thành').length / a[1].length;
    const pctB = b[1].filter((r) => r.TaskStatus === 'Hoàn thành').length / b[1].length;
    return pctB - pctA;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[19px] font-bold">Báo cáo — Hiệu suất nhân viên</h1>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2"
        >
          <Printer className="w-3.5 h-3.5" /> IN BÁO CÁO
        </button>
      </div>

      {/* KPI tổng quan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Tổng số phòng</div>
            <div className="text-xl font-extrabold text-slate-800">{total}</div>
          </div>
          <Building2 className="w-6 h-6 text-slate-300" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-emerald-500 uppercase">Đã dọn</div>
            <div className="text-xl font-extrabold text-emerald-600">{doneCount}</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-200" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-amber-600 uppercase">DND</div>
            <div className="text-xl font-extrabold text-amber-700">{dndCount}</div>
          </div>
          <Clock3 className="w-6 h-6 text-amber-200" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-purple-600 uppercase">Refused</div>
            <div className="text-xl font-extrabold text-purple-700">{rfCount}</div>
          </div>
          <AlertCircle className="w-6 h-6 text-purple-200" />
        </div>
      </div>

      {/* Hiệu suất từng nhân viên */}
      {staffEntries.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-10">Chưa có phòng nào được phân công hôm nay.</div>
      ) : (
        <div className="space-y-3">
          {staffEntries.map(([staff, staffRooms]) => {
            const done = staffRooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
            const pct = staffRooms.length > 0 ? Math.round((done / staffRooms.length) * 100) : 0;
            const minutes = sumDuration(staffRooms.filter((r) => r.TaskStatus === 'Hoàn thành'));
            const trolleyCode = staffRooms.find((r) => r.TrolleyCode)?.TrolleyCode || '';
            const vacuumFloor = staffRooms.find((r) => r.VacuumFloor)?.VacuumFloor || '';
            return (
              <div key={staff} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[14px] text-slate-800">{staff}</span>
                  <span className="text-[12px] font-bold text-slate-500">
                    {pct}% — {done}/{staffRooms.length} nhiệm vụ — {minutes} phút
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                {(trolleyCode || vacuumFloor) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {trolleyCode && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        🛒 Xe: {trolleyCode}
                      </span>
                    )}
                    {vacuumFloor && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        Hút bụi: {vacuumFloor}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ghi chú nhân viên hôm nay — VD khách yêu cầu riêng, giám sát cần nắm được */}
      {staffNotedRooms.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
            <MessageSquareText className="w-4 h-4 text-blue-500" /> Ghi chú nhân viên hôm nay
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2">
            {staffNotedRooms.map((r) => (
              <div key={r.MaPhong} className="flex items-start gap-3 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="bg-slate-100 text-slate-600 font-extrabold rounded-lg px-2 py-1 text-[12px] flex-shrink-0">
                  {r.MaPhong}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-700">
                    {staffNoteFor(r)}
                    {!stripCodesFromNote(r.GhiChuNV) && <span className="text-[10px] text-slate-400 font-normal ml-1">(hôm qua)</span>}
                  </div>
                  {r.NhanVienPhuTrach && <div className="text-[10px] text-slate-400">Nhân viên: {r.NhanVienPhuTrach}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ghi chú giám sát hôm nay — GhiChuAdmin, lưu trữ/theo dõi thông tin do Admin/Giám sát tự ghi */}
      {adminNotedRooms.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
            <MessageSquareWarning className="w-4 h-4 text-amber-600" /> Ghi chú giám sát hôm nay
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-2">
            {adminNotedRooms.map((r) => (
              <div key={r.MaPhong} className="flex items-start gap-3 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="bg-amber-100 text-amber-700 font-extrabold rounded-lg px-2 py-1 text-[12px] flex-shrink-0">
                  {r.MaPhong}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-700">
                    {adminNoteFor(r)}
                    {!r.GhiChuAdmin && <span className="text-[10px] text-slate-400 font-normal ml-1">(hôm qua)</span>}
                  </div>
                  {r.NhanVienPhuTrach && <div className="text-[10px] text-slate-400">Nhân viên phụ trách: {r.NhanVienPhuTrach}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module 2 — Giao nhận chìa khóa (chỉ xem, đồng bộ mỗi 15s) — mỗi thẻ đã tự hiện Nhận/Trả */}
      <div className="mt-6">
        <h2 className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-slate-500" /> Giao nhận chìa khóa
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <KeyBoard keyLogs={keyLogs} />
        </div>
      </div>

      {/* HOUSEKEEPING DAILY REPORT — 9 cột chuẩn nghiệp vụ khách sạn tiếng Anh */}
      <div className="mt-6">
        <h2 className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
          <ListChecks className="w-4 h-4 text-slate-500" /> HOUSEKEEPING DAILY REPORT — {todayStr}
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">
                <th className="px-3 py-2 text-left">Room</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Assigned Staff</th>
                <th className="px-2 py-2 text-left">Check-in / Check-out</th>
                <th className="px-2 py-2 text-center">Morning Status</th>
                <th className="px-2 py-2 text-center">Current Status</th>
                <th className="px-2 py-2 text-center">Working Time</th>
                <th className="px-2 py-2 text-center">Safe Box</th>
                <th className="px-3 py-2 text-left">Remarks (QL &amp; NV)</th>
              </tr>
            </thead>
            <tbody>
              {allRoomsSorted.map((r) => {
                // Cột 5 — MORNING STATUS: ảnh chụp cố định lúc Đồng bộ AI, KHÔNG đổi trong ngày
                const morningBadge = STATUS_BADGE_EN[r.MorningStatus] || STATUS_BADGE_EN['Phòng dơ'];
                // Cột 6 — CURRENT STATUS: thực tế real-time; "Đang kiểm phòng" (isInspecting) ưu tiên hiện CHECKING
                const currentBadge = r.isInspecting ? CHECKING_BADGE : (STATUS_BADGE_EN[r.HkStatus] || STATUS_BADGE_EN['Phòng dơ']);
                const workingTime = r.StartTime ? `${formatTimeOnly(r.StartTime)} - ${r.EndTime ? formatTimeOnly(r.EndTime) : ''}` : '—';
                const codes = extractNoteCodes(combineNotes(r.GhiChu, r.GhiChuNV, r.GhiChuAdmin));
                const dndTimes = dndTimesByRoom[r.MaPhong] || [];
                const rfTimes = rfTimesByRoom[r.MaPhong] || [];
                const staffNote = stripCodesFromNote(r.GhiChuNV);

                return (
                  <tr key={r.MaPhong} className="border-t border-slate-50 align-top">
                    <td className="px-3 py-2 font-bold text-slate-800">{r.MaPhong}</td>
                    <td className="px-2 py-2 text-slate-600 font-semibold">{r.LoaiPhong}</td>
                    <td className="px-2 py-2 text-slate-600 font-semibold whitespace-nowrap">{r.NhanVienPhuTrach || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 font-semibold whitespace-nowrap">{formatDateShort(r.NgayO) || '—'}</td>
                    <td className="px-2 py-2 text-center"><StatusBadge {...morningBadge} /></td>
                    <td className="px-2 py-2 text-center"><StatusBadge {...currentBadge} /></td>
                    <td className="px-2 py-2 text-center text-slate-500 font-semibold whitespace-nowrap">{workingTime}</td>
                    <td className="px-2 py-2 text-center">
                      {r.SafeStatus === 'Đóng' ? (
                        <span className="inline-block bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded text-[10px]">LOCKED</span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {codes.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          {codes.map((code, i) => {
                            if (code === 'DND') {
                              return (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold whitespace-nowrap">
                                  🌙 DND{dndTimes.length > 0 ? ` - ${dndTimes.join(', ')}` : ''}
                                </span>
                              );
                            }
                            if (code === 'RF') {
                              return (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold whitespace-nowrap">
                                  ⚠️ RF{rfTimes.length > 0 ? ` - ${rfTimes.join(', ')}` : ''}
                                </span>
                              );
                            }
                            return (
                              <span key={i} className="inline-block bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded text-[10px]">
                                {code}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {r.GhiChuAdmin && <div className="text-[11px]">QL: {r.GhiChuAdmin}</div>}
                      {staffNote && <div className="text-[11px]">NV: {staffNote}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
