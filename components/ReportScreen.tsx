'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock3, AlertCircle, Printer, KeyRound, MessageSquareText } from 'lucide-react';
import type { Room, KeyLog } from '@/lib/types';
import { getKeyLogs } from '@/lib/api';
import { stripCodesFromNote } from '@/lib/roomStyles';
import KeyBoard from './KeyBoard';

interface ReportScreenProps {
  rooms: Room[];
}

/** Tổng số phút từ danh sách Duration dạng chuỗi (bỏ qua giá trị rỗng/không hợp lệ) */
function sumDuration(rooms: Room[]): number {
  return rooms.reduce((sum, r) => sum + (parseInt(r.Duration, 10) || 0), 0);
}

export default function ReportScreen({ rooms }: ReportScreenProps) {
  const [keyLogs, setKeyLogs] = useState<KeyLog[]>([]);

  useEffect(() => {
    getKeyLogs().then(setKeyLogs);
    const timer = setInterval(() => getKeyLogs().then(setKeyLogs), 15000);
    return () => clearInterval(timer);
  }, []);

  // Mục "Ghi chú nhân viên" — liệt kê toàn bộ phòng có ghi chú tự do (VD khách yêu cầu riêng),
  // để giám sát xem 1 chỗ, không cần mở từng phòng trên Sơ đồ.
  const staffNotedRooms = rooms.filter((r) => stripCodesFromNote(r.GhiChuNV));

  const total = rooms.length;
  const doneCount = rooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
  const cleaningCount = rooms.filter((r) => r.TaskStatus === 'Đang dọn').length;
  const dirtyCount = rooms.filter((r) => r.TaskStatus === 'Chưa dọn' || !r.TaskStatus).length;

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
            <div className="text-[10px] font-bold text-blue-500 uppercase">Đang dọn</div>
            <div className="text-xl font-extrabold text-blue-600">{cleaningCount}</div>
          </div>
          <Clock3 className="w-6 h-6 text-blue-200" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-3.5 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-red-500 uppercase">Cần dọn</div>
            <div className="text-xl font-extrabold text-red-600">{dirtyCount}</div>
          </div>
          <AlertCircle className="w-6 h-6 text-red-200" />
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
                  <div className="text-[13px] font-semibold text-slate-700">{stripCodesFromNote(r.GhiChuNV)}</div>
                  {r.NhanVienPhuTrach && <div className="text-[10px] text-slate-400">Nhân viên: {r.NhanVienPhuTrach}</div>}
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
    </div>
  );
}
