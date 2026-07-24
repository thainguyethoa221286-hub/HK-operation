'use client';

import { useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import type { Room, HkStatus, FoStatus } from '@/lib/types';
import { HK_STATUSES, FO_STATUSES, FLAGS, STAFF_LIST } from '@/lib/types';

interface RoomModalProps {
  room: Room | null;
  onClose: () => void;
  onSave: (maPhong: string, changes: Partial<Room>) => void;
  onToggleInspecting: (maPhong: string, value: boolean) => void;
}

export default function RoomModal({ room, onClose, onSave, onToggleInspecting }: RoomModalProps) {
  const [hk, setHk] = useState<HkStatus>('Phòng dơ');
  const [fo, setFo] = useState<FoStatus>('Vacant');
  const [staff, setStaff] = useState('');
  const [note, setNote] = useState('');
  const [flags, setFlags] = useState<string[]>([]);

  useEffect(() => {
    if (!room) return;
    setHk(room.HkStatus);
    setFo(room.FoStatus);
    setStaff(room.NhanVienPhuTrach || 'Chưa gán');
    setNote(room.GhiChu || '');
    setFlags((room.Flags || '').split(',').map((f) => f.trim()).filter(Boolean));
  }, [room]);

  if (!room) return null;

  const cycleStaff = () => {
    const idx = STAFF_LIST.indexOf(staff);
    setStaff(STAFF_LIST[(idx + 1) % STAFF_LIST.length]);
  };

  const toggleFlag = (key: string) => {
    setFlags((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const tagNote = () => setNote((prev) => (prev ? prev + ' ' : '') + '[Sửa chữa] ');

  const handleClose = () => {
    onSave(room.MaPhong, {
      HkStatus: hk,
      FoStatus: fo,
      NhanVienPhuTrach: staff,
      GhiChu: note,
      Flags: flags.join(','),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-[420px] rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-[17px] font-bold">Phòng {room.MaPhong}</h4>
            <div className="text-xs text-slate-500 mt-0.5">
              {room.LoaiPhong} • {room.NgayO || '—'}
            </div>
          </div>
          <X className="w-[18px] h-[18px] text-slate-500 cursor-pointer" onClick={onClose} />
        </div>

        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Tình trạng phòng
            </label>
            <select
              value={hk}
              onChange={(e) => setHk(e.target.value as HkStatus)}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50"
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
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-slate-50"
            >
              {FO_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div
          onClick={cycleStaff}
          className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3 py-2.5 mb-3.5 cursor-pointer"
        >
          <div className="w-[26px] h-[26px] rounded-full bg-blue-200 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-blue-700" />
          </div>
          <div className="font-semibold text-sm">{staff}</div>
        </div>

        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Điều phối</div>
        <div className="grid grid-cols-4 gap-2 mb-3.5">
          {FLAGS.map((f) => {
            const active = flags.includes(f.key);
            return (
              <div
                key={f.key}
                onClick={() => toggleFlag(f.key)}
                className={`border rounded-xl px-1 py-2.5 text-center text-[10px] font-semibold cursor-pointer ${
                  active ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-500 bg-white'
                }`}
              >
                <span className="block text-base mb-1">{f.icon}</span>
                {f.label}
              </div>
            );
          })}
        </div>

        {/* Mục 3 — Logic tương tác Kiểm phòng / Nhả phòng (isInspecting) */}
        <div className="flex gap-2 mb-3.5">
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

        <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Ghi chú cho nhân viên</div>
        <div className="relative mb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: Khách hàng cần thêm gối..."
            className="w-full min-h-[70px] border border-slate-200 rounded-lg p-2.5 text-sm resize-y"
          />
          <button
            onClick={tagNote}
            className="absolute -top-2.5 right-2 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded"
          >
            ✎ Sửa chữa
          </button>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-navy text-white rounded-xl py-3.5 text-[13px] font-bold tracking-wide"
        >
          ĐÓNG
        </button>
      </div>
    </div>
  );
}
