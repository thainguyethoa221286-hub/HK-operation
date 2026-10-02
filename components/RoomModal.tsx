'use client';

import { useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import type { Room, HkStatus, FoStatus, Account } from '@/lib/types';
import { HK_STATUSES, FO_STATUSES, FLAGS } from '@/lib/types';
import { formatDateShort, removeNoteCode, combineNotes, isLongStay, LinenChangeBadge } from '@/lib/roomStyles';
import { createMaintenanceIssue } from '@/lib/api';

interface RoomModalProps {
  room: Room | null;
  onClose: () => void;
  onSave: (maPhong: string, changes: Partial<Room>) => void;
  onToggleInspecting: (maPhong: string, value: boolean) => void;
  /** Mục 1 — danh sách tên nhân viên lấy ĐỘNG từ tab TaiKhoan, không hardcode */
  staffList: string[];
  /** Tài khoản Admin/Giám sát đang đăng nhập — dùng làm "Người báo" khi tự tạo ticket Maintenance */
  account: Account | null;
}

export default function RoomModal({ room, onClose, onSave, onToggleInspecting, staffList, account }: RoomModalProps) {
  const [hk, setHk] = useState<HkStatus>('Phòng dơ');
  const [fo, setFo] = useState<FoStatus>('Vacant');
  const [staff, setStaff] = useState('');
  const [note, setNote] = useState('');
  const [flags, setFlags] = useState<string[]>([]);
  // Ghi chú Sửa chữa — TÁCH RIÊNG hoàn toàn khỏi ghi chú nhân viên/giám sát, chỉ hiện khi cờ Sửa chữa bật
  const [repairNote, setRepairNote] = useState('');
  const [initialRepairNote, setInitialRepairNote] = useState('');
  // Cờ Sửa chữa lúc VỪA MỞ modal (trước khi người dùng bấm gì) — dùng để phát hiện đúng thời điểm
  // BẬT MỚI (TẮT -> BẬT) trong phiên này, tránh tạo ticket trùng mỗi lần đóng modal khi phòng đã
  // đang Sửa chữa từ trước.
  const [initialFlags, setInitialFlags] = useState<string[]>([]);

  useEffect(() => {
    if (!room) return;
    setHk(room.HkStatus);
    setFo(room.FoStatus);
    setStaff(room.NhanVienPhuTrach || '');
    setNote(room.GhiChuAdmin || '');
    setRepairNote(room.GhiChuSuaChua || '');
    setInitialRepairNote(room.GhiChuSuaChua || '');
    const f = (room.Flags || '').split(',').map((f) => f.trim()).filter(Boolean);
    setFlags(f);
    setInitialFlags(f);
  }, [room]);

  if (!room) return null;

  // Badge LSG (Long Stay Guest) — hiện ngay kế bên số phòng trong popup Chi tiết phòng khi phòng
  // được tính là khách lưu trú dài hạn (tự động >6 đêm, hoặc nhân viên đã gõ tay mã "LSG").
  const showLsg = isLongStay(combineNotes(room.GhiChu, room.GhiChuNV, room.GhiChuAdmin), room.NgayO);

  const toggleFlag = (key: string) => {
    setFlags((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  // Fix 1 — nút "Đã out": HK Status luôn về "Phòng dơ"; FO Status: Occupied/Due out -> Vacant, Due out/ARR -> Arrival
  const handleDaOut = () => {
    setFo((prev) => {
      if (prev === 'Occupied' || prev === 'Due out') return 'Vacant';
      if (prev === 'Due out/ARR') return 'Arrival';
      return prev;
    });
    setHk('Phòng dơ');
    toggleFlag('DaOut');
  };

  const isRepairActive = flags.includes('SuaChua');

  const handleClose = async () => {
    // Mục 1 — Liên kết Pop-up Sơ đồ phòng -> Module Maintenance: CHỈ CẦN bấm BẬT tag "Sửa chữa"
    // (TẮT -> BẬT trong phiên này) là tự tạo 1 ticket mới sang Maintenance, CÓ GÕ GHI CHÚ HAY KHÔNG
    // cũng được — nếu không gõ gì thì dùng mô tả mặc định, giám sát vào Module Bảo trì sửa trực
    // tiếp sau (ô mô tả bên đó đã cho sửa inline). Trước đây BẮT BUỘC phải gõ nội dung mới tạo
    // ticket -> nếu chỉ bấm bật tag mà không gõ gì thì KHÔNG có ticket nào được tạo, im lặng không
    // báo gì (đúng lỗi chị báo: "bấm sửa chữa trên tag thì dữ liệu kg trả về report maintenance").
    //
    // LƯU Ý: await + báo lỗi rõ ràng nếu ghi thất bại (trước đây gọi "bắn rồi quên", lỗi mạng/ghi
    // dữ liệu bị mất ÂM THẦM, không ai biết ticket không được tạo cho tới khi kiểm tra lại Maintenance).
    const wasRepairActive = initialFlags.includes('SuaChua');
    if (isRepairActive && !wasRepairActive) {
      const desc = repairNote.trim() || 'Chưa có mô tả — cập nhật tại Module Bảo trì';
      const res = await createMaintenanceIssue(room.MaPhong, desc, account?.hoTen || 'Giám sát');
      if (!res.success) {
        window.alert(`⚠ Không ghi được sự cố "Sửa chữa" cho phòng ${room.MaPhong} vào Maintenance:\n${res.error || 'Lỗi không rõ nguyên nhân'}\n\nCác thay đổi khác của phòng vẫn được lưu — chị vào module Maintenance thêm thủ công ticket này giúp mình.`);
      }
    }

    // Bật cờ MKR — DND/RF đã hết hiệu lực (phòng cần trang điểm/chuẩn bị, không còn từ chối/không làm phiền
    // nữa), tự động gỡ mã DND/RF khỏi CẢ 3 nguồn ghi chú để hết hẳn badge, không chỉ ẩn ở 1 chỗ.
    const changes: Partial<Room> = {
      HkStatus: hk,
      FoStatus: fo,
      NhanVienPhuTrach: staff,
      GhiChuAdmin: note,
      GhiChuSuaChua: repairNote,
      Flags: flags.join(','),
    };
    if (flags.includes('TrangDiem')) {
      const strip = (s: string) => removeNoteCode(removeNoteCode(s, 'DND'), 'RF');
      changes.GhiChu = strip(room.GhiChu || '');
      changes.GhiChuNV = strip(room.GhiChuNV || '');
      changes.GhiChuAdmin = strip(note);
    }

    onSave(room.MaPhong, changes);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-[420px] border-2 border-slate-300 shadow-2xl shadow-black/30 rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 pb-0 overflow-y-auto scrollbar-none h-auto">
          <div className="flex justify-between items-start mb-2.5 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-[17px] font-bold">Phòng {room.MaPhong}</h4>
                {showLsg && (
                  <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded-md text-xs shadow-sm">
                    LSG
                  </span>
                )}
                <LinenChangeBadge room={room} />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {room.LoaiPhong} • {formatDateShort(room.NgayO) || '—'}
              </div>
            </div>
            <X className="w-[18px] h-[18px] text-slate-500 cursor-pointer" onClick={handleClose} />
          </div>

          <div className="flex gap-2.5 mb-2.5">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Tình trạng phòng
              </label>
              <select
                value={hk}
                onChange={(e) => setHk(e.target.value as HkStatus)}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-slate-50/50 hover:bg-white transition-all"
              >
                {HK_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Trạng thái khách
              </label>
              <select
                value={fo}
                onChange={(e) => setFo(e.target.value as FoStatus)}
                className="w-full border border-slate-200 rounded-xl px-2 py-2 text-sm bg-slate-50/50 hover:bg-white transition-all"
              >
                {FO_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-white transition-all px-3 py-2.5 mb-2.5">
            <div className="w-[26px] h-[26px] rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="flex-1 bg-transparent font-semibold text-sm outline-none cursor-pointer"
            >
              <option value="">— Chưa gán —</option>
              {staffList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Điều phối</div>
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {FLAGS.map((f) => {
              const active = flags.includes(f.key);
              return (
                <div
                  key={f.key}
                  onClick={() => (f.key === 'DaOut' ? handleDaOut() : toggleFlag(f.key))}
                  className={`border-2 rounded-xl px-1 py-2.5 text-center text-[10px] font-semibold cursor-pointer transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50/50 text-blue-600'
                      : 'border-slate-200 text-slate-500 bg-white hover:border-blue-500 hover:bg-blue-50/50'
                  }`}
                >
                  <span className="block text-base mb-1">{f.icon}</span>
                  {f.label}
                </div>
              );
            })}
          </div>

          {/* Ô Ghi chú Sửa chữa RIÊNG — chỉ hiện khi cờ "Sửa chữa" đang bật, tách biệt hoàn toàn
              khỏi Ghi chú nhân viên/giám sát. Nội dung này tự đổ sang Module Maintenance khi Đóng. */}
          {isRepairActive && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase mb-2">
                🔧 Ghi chú sửa chữa
              </div>
              <textarea
                value={repairNote}
                onChange={(e) => setRepairNote(e.target.value)}
                placeholder="Mô tả sự cố cần sửa (VD: AC ồn, cửa bị cứng...)"
                className="w-full min-h-[60px] border border-orange-200 rounded-lg p-2.5 text-sm resize-y bg-white"
              />
            </div>
          )}

          {/* Mục 3 — Logic tương tác Kiểm phòng / Nhả phòng (isInspecting) */}
          <div className="flex gap-2 mb-2.5">
            <button
              onClick={() => onToggleInspecting(room.MaPhong, true)}
              disabled={room.isInspecting}
              className="flex-1 rounded-lg py-2.5 text-xs font-bold bg-yellow-100 text-yellow-800 disabled:opacity-40"
            >
              🔍 KIỂM PHÒNG
            </button>
            <button
              onClick={() => onToggleInspecting(room.MaPhong, false)}
              disabled={!room.isInspecting}
              className="flex-1 rounded-lg py-2.5 text-xs font-bold bg-green-100 text-green-700 disabled:opacity-40"
            >
              ✓ NHẢ PHÒNG
            </button>
          </div>

          {/* Ghi chú nhân viên tự gõ (VD khách yêu cầu riêng) — chỉ đọc, giám sát cần thấy được */}
          {room.GhiChuNV && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 mb-2.5">
              <span className="text-[10px] font-bold text-blue-500 uppercase flex-shrink-0 mt-0.5">Nhân viên ghi:</span>
              <span className="text-[13px] font-semibold text-blue-900">{room.GhiChuNV}</span>
            </div>
          )}

          <div className="text-[10px] font-bold text-slate-500 uppercase mb-1.5">Ghi chú cho nhân viên</div>
          <div className="relative mb-2.5">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Khách hàng cần thêm gối..."
              className="w-full min-h-[70px] border border-slate-200 rounded-lg p-2.5 text-sm resize-y"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 p-5 pt-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="w-full bg-navy text-white rounded-xl py-3.5 text-[13px] font-bold tracking-wide"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
}
