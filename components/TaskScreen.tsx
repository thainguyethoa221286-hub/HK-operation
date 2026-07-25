'use client';

import type { Room, Account } from '@/lib/types';
import RoomTaskCard from './RoomTaskCard';
import { updateRoomFields } from '@/lib/api';
import { TASK_STATUS_STYLE } from '@/lib/roomStyles';

interface TaskScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  account: Account;
}

export default function TaskScreen({ rooms, setRooms, account }: TaskScreenProps) {
  const isStaff = account.vaiTro === 'HKStaff';

  const handleUpdate = async (maPhong: string, fields: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, ...fields } : r)));
    const stringFields: Record<string, string> = {};
    Object.entries(fields).forEach(([k, v]) => { stringFields[k] = String(v ?? ''); });
    await updateRoomFields(maPhong, stringFields);
  };

  /* ===== HK STAFF — chỉ thấy phòng có tên mình trong NhanVienPhuTrach
     (kể cả khi phòng được tag cho 2 người, VD "Tâm+Nghị") ===== */
  if (isStaff) {
    const myRooms = rooms.filter((r) =>
      (r.NhanVienPhuTrach || '').split('+').map((s) => s.trim()).includes(account.hoTen)
    );
    const doneCount = myRooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
    const percent = myRooms.length > 0 ? Math.round((doneCount / myRooms.length) * 100) : 0;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[19px] font-bold">Nhiệm vụ của tôi</h1>
          <span className="text-xs font-bold text-slate-500">Đã xong: {doneCount}/{myRooms.length} phòng — {percent}%</span>
        </div>
        {myRooms.length > 0 && (
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
        )}
        {myRooms.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-10">Chưa có phòng nào được giao cho bạn hôm nay.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myRooms.map((room) => (
              <RoomTaskCard key={room.MaPhong} room={room} onUpdate={handleUpdate} />
            ))}
          </div>
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
        <div className="space-y-4">
          {Object.entries(byStaff).map(([staff, staffRooms]) => {
            const done = staffRooms.filter((r) => r.TaskStatus === 'Hoàn thành').length;
            return (
              <div key={staff} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 border-b border-slate-200">
                  <span className="font-bold text-sm">{staff}</span>
                  <span className="text-xs font-bold text-slate-500">{done}/{staffRooms.length} xong</span>
                </div>
                <div className="p-2.5 flex flex-wrap gap-2">
                  {staffRooms.map((r) => {
                    const style = TASK_STATUS_STYLE[r.TaskStatus] || TASK_STATUS_STYLE['Chưa dọn'];
                    return (
                      <span
                        key={r.MaPhong}
                        className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1.5 rounded-lg ${style.cls}`}
                      >
                        {r.MaPhong}
                        <span className="opacity-70">· {style.label}</span>
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
