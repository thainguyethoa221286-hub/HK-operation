'use client';

import { useEffect, useState } from 'react';
import type { Room, Account, KeyLog } from '@/lib/types';
import { VACUUM_FLOORS } from '@/lib/types';
import RoomCard from './RoomCard';
import RoomTaskModal from './RoomTaskModal';
import KeyBoard from './KeyBoard';
import { updateRoomFields, getKeyLogs, borrowKey, returnKey } from '@/lib/api';
import { TASK_STATUS_STYLE, formatTimeOnly } from '@/lib/roomStyles';
import { Truck, Lock } from 'lucide-react';

const SETTLED_STATUSES = ['Hoàn thành', 'Refused', 'DND'];

/** Mục 3B — thứ tự ưu tiên cho phòng CHƯA settled: Rush(0) > Arrival/Due out-ARR(1) > MKR(2) > còn lại(3) */
function priorityTier(r: Room): number {
  const flags = (r.Flags || '').split(',').map((f) => f.trim());
  if (flags.includes('CayBac')) return 0; // Rush
  if (r.FoStatus === 'Arrival' || r.FoStatus === 'Due out/ARR') return 1; // đón khách trong ngày
  if (flags.includes('TrangDiem')) return 2; // MKR
  return 3;
}

/** Mục 3 — sắp xếp: phòng chưa xong lên trước (theo tier ưu tiên, rồi số phòng tăng dần),
 *  phòng Hoàn thành/Refused/DND bị đẩy xuống cuối danh sách. */
function sortTaskRooms(list: Room[]): Room[] {
  return [...list].sort((a, b) => {
    const aSettled = SETTLED_STATUSES.includes(a.TaskStatus) ? 1 : 0;
    const bSettled = SETTLED_STATUSES.includes(b.TaskStatus) ? 1 : 0;
    if (aSettled !== bSettled) return aSettled - bSettled;
    if (aSettled === 0) {
      const pa = priorityTier(a), pb = priorityTier(b);
      if (pa !== pb) return pa - pb;
    }
    return Number(a.MaPhong) - Number(b.MaPhong);
  });
}

/** Vòng tròn % tiến độ (SVG thuần, không cần thư viện chart) */
function ProgressRing({ percent }: { percent: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);
  return (
    <div className="relative w-[88px] h-[88px] flex-shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="#0f172a" strokeWidth="9" fill="none" />
        <circle
          cx="44" cy="44" r={r} stroke="#22c55e" strokeWidth="9" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 0.4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-green-500 font-extrabold text-lg">{percent}%</span>
      </div>
    </div>
  );
}

interface TaskScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  account: Account;
}

export default function TaskScreen({ rooms, setRooms, account }: TaskScreenProps) {
  const isStaff = account.vaiTro === 'HKStaff';
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [keyLogs, setKeyLogs] = useState<KeyLog[]>([]);

  const refreshKeyLogs = () => { getKeyLogs().then(setKeyLogs); };
  useEffect(() => {
    refreshKeyLogs();
    const timer = setInterval(refreshKeyLogs, 15000); // đồng bộ khi người khác mượn/trả chìa
    return () => clearInterval(timer);
  }, []);

  const handleBorrowKey = async (keyLabel: string) => {
    const res = await borrowKey(account.hoTen, keyLabel);
    if (!res.success) { alert(res.error || 'Không mượn được chìa này'); }
    refreshKeyLogs();
  };
  const handleReturnKey = async (rowIndex: number) => {
    await returnKey(rowIndex);
    refreshKeyLogs();
  };

  // Ô Máy hút bụi — ghi VacuumFloor lên TOÀN BỘ phòng đang được giao cho nhân viên này hôm nay
  const handleSetVacuumFloor = async (maPhongList: string[], floor: string) => {
    setRooms((prev) => prev.map((r) => (maPhongList.includes(r.MaPhong) ? { ...r, VacuumFloor: floor } : r)));
    await Promise.all(maPhongList.map((id) => updateRoomFields(id, { VacuumFloor: floor })));
  };

  const handleUpdate = async (maPhong: string, fields: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, ...fields } : r)));
    const stringFields: Record<string, string> = {};
    Object.entries(fields).forEach(([k, v]) => { stringFields[k] = String(v ?? ''); });
    await updateRoomFields(maPhong, stringFields);
  };

  /* ===== HK STAFF — chỉ thấy phòng có tên mình trong NhanVienPhuTrach
     (kể cả khi phòng được tag cho 2 người, VD "Tâm+Nghị") ===== */
  if (isStaff) {
    const myRoomsRaw = rooms.filter((r) =>
      (r.NhanVienPhuTrach || '').split('+').map((s) => s.trim()).includes(account.hoTen)
    );
    const myRooms = sortTaskRooms(myRoomsRaw);
    const doneCount = myRoomsRaw.filter((r) => r.TaskStatus === 'Hoàn thành').length;
    const percent = myRoomsRaw.length > 0 ? Math.round((doneCount / myRoomsRaw.length) * 100) : 0;
    const dirtyCount = myRoomsRaw.filter((r) => r.TaskStatus === 'Chưa dọn').length;
    const cleaningCount = myRoomsRaw.filter((r) => r.TaskStatus === 'Đang dọn').length;
    const arrivalCount = myRoomsRaw.filter((r) => r.FoStatus === 'Arrival').length;
    const dndCount = myRoomsRaw.filter((r) => r.TaskStatus === 'DND').length;
    const rfCount = myRoomsRaw.filter((r) => r.TaskStatus === 'Refused').length;

    // Chìa khóa đang giữ (nếu có) — quyết định khóa/mở toàn bộ thao tác phía dưới
    const myKey = keyLogs.find((l) => l.nhanVien === account.hoTen && l.trangThai === 'Đang giữ');
    // Mã xe đẩy — tự động lấy từ mã nhóm đã gán ở tab Phân công (ghi kèm khi giám sát gán phòng)
    const trolleyCode = myRoomsRaw.find((r) => r.TrolleyCode)?.TrolleyCode || '';
    // Tầng máy hút bụi hiện tại — lấy từ phòng nào đã có giá trị (đồng bộ chung 1 giá trị cho cả ca)
    const vacuumFloor = myRoomsRaw.find((r) => r.VacuumFloor)?.VacuumFloor || '';
    const myRoomIds = myRoomsRaw.map((r) => r.MaPhong);

    // Đồng bộ với RoomCard đang cần: đảm bảo phòng luôn thể hiện đúng dữ liệu mới nhất trong modal đang mở
    const currentSelected = selectedRoom ? rooms.find((r) => r.MaPhong === selectedRoom.MaPhong) || null : null;

    return (
      <div>
        <h1 className="text-[19px] font-bold mb-3">Nhiệm vụ của tôi</h1>

        {/* ===== KHUNG BÀN GIAO THIẾT BỊ & XE ĐẨY — đầu màn hình, trước tiến độ và danh sách phòng ===== */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-500" />
              <span className="text-[13px] font-extrabold text-slate-700">BÀN GIAO THIẾT BỊ</span>
            </div>
            {trolleyCode ? (
              <span className="bg-slate-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                🛒 Xe số: {trolleyCode}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 font-semibold">Chưa có mã xe đẩy (chờ giám sát phân công)</span>
            )}
          </div>

          {/* Ô máy hút bụi */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
            <span className="text-[12px] font-bold text-slate-600">🧹 Máy hút bụi</span>
            <select
              value={vacuumFloor}
              onChange={(e) => handleSetVacuumFloor(myRoomIds, e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-slate-700"
            >
              <option value="">— Chưa lấy —</option>
              {VACUUM_FLOORS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Nhận / trả chìa khóa */}
          {myKey ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              <span className="text-[12px] font-bold text-emerald-700">
                🔑 Đã nhận chìa: {myKey.keyLabel} · {formatTimeOnly(myKey.gioMuon)}
              </span>
              <button
                onClick={() => handleReturnKey(myKey.rowIndex)}
                className="text-[11px] font-bold text-red-600 bg-white border border-red-200 rounded-lg px-2.5 py-1.5"
              >
                TRẢ CHÌA KHÓA
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2.5 text-[12px] font-bold text-red-600">
                <Lock className="w-3.5 h-3.5" /> Chưa nhận chìa khóa — chọn 1 bộ chìa bên dưới để mở khóa nhiệm vụ
              </div>
              <KeyBoard keyLogs={keyLogs} myName={account.hoTen} onBorrow={handleBorrowKey} onReturn={handleReturnKey} />
            </div>
          )}
        </div>

        {/* Bảng thống kê tiến độ */}
        {myRoomsRaw.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-4">
              <ProgressRing percent={percent} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-extrabold text-slate-700">
                  TIẾN ĐỘ DỌN PHÒNG — Đã dọn: {doneCount}/{myRoomsRaw.length} phòng
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3.5">
              <div className="bg-red-50 border border-red-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-red-500 text-[10px] font-bold">Cần dọn</div>
                <div className="text-red-600 text-lg font-extrabold">{dirtyCount}</div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-blue-500 text-[10px] font-bold">Đang dọn</div>
                <div className="text-blue-600 text-lg font-extrabold">{cleaningCount}</div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-green-500 text-[10px] font-bold">Đã dọn</div>
                <div className="text-green-600 text-lg font-extrabold">{doneCount}</div>
              </div>
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-sky-500 text-[10px] font-bold">Khách đến</div>
                <div className="text-sky-600 text-lg font-extrabold">{arrivalCount}</div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-amber-600 text-[10px] font-bold">DND</div>
                <div className="text-amber-700 text-lg font-extrabold">{dndCount}</div>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl px-2.5 py-2 text-center">
                <div className="text-purple-600 text-[10px] font-bold">RF</div>
                <div className="text-purple-700 text-lg font-extrabold">{rfCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách phòng — BỊ KHÓA cho tới khi nhận chìa khóa */}
        {!myKey ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl py-10 text-center">
            <Lock className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <div className="text-[13px] font-bold text-slate-400">Danh sách phòng đang khóa</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Nhận chìa khóa ở khung phía trên để bắt đầu dọn phòng</div>
          </div>
        ) : myRooms.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-10">Chưa có phòng nào được giao cho bạn hôm nay.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {myRooms.map((room) => (
              <RoomCard key={room.MaPhong} room={room} onClick={() => setSelectedRoom(room)} />
            ))}
          </div>
        )}

        {currentSelected && (
          <RoomTaskModal room={currentSelected} onUpdate={handleUpdate} onClose={() => setSelectedRoom(null)} />
        )}
      </div>
    );
  }

  /* ===== ADMIN / GIÁM SÁT — tổng quan tiến độ toàn bộ nhân viên (chỉ xem, không thao tác) ===== */
  const assignedRooms = rooms.filter((r) => r.NhanVienPhuTrach);
  const byStaff = assignedRooms.reduce<Record<string, Room[]>>((acc, r) => {
    (acc[r.NhanVienPhuTrach] = acc[r.NhanVienPhuTrach] || []).push(r);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-[19px] font-bold mb-4">Tiến độ dọn phòng</h1>
      {Object.keys(byStaff).length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-10">Chưa có phòng nào được phân công.</div>
      ) : (
        <div className="space-y-3.5">
          {Object.entries(byStaff).map(([staff, staffRooms]) => {
            const done = staffRooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
            const pct = staffRooms.length > 0 ? Math.round((done / staffRooms.length) * 100) : 0;
            return (
              <div key={staff} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 font-extrabold flex items-center justify-center text-[13px] flex-shrink-0">
                    {staff.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[14px] text-slate-800 truncate">{staff}</span>
                      <span className="text-[11px] font-extrabold text-slate-500 flex-shrink-0">{done}/{staffRooms.length} xong</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="p-3 flex flex-wrap gap-1.5">
                  {staffRooms.map((r) => {
                    const style = TASK_STATUS_STYLE[r.TaskStatus] || TASK_STATUS_STYLE['Chưa dọn'];
                    return (
                      <span
                        key={r.MaPhong}
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-full ${style.cls}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {r.MaPhong}
                        <span className="opacity-70 font-semibold">· {style.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
