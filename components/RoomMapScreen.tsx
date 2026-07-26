'use client';

import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Room } from '@/lib/types';
import RoomCard from '@/components/RoomCard';
import RoomModal from '@/components/RoomModal';
import { updateRoomField, bulkUpdateFromAI, readPdfWithAI, fetchRooms } from '@/lib/api';

const LEGEND = [
  { label: 'Phòng dơ', dot: 'bg-red-500' },
  { label: 'Phòng đang dọn', dot: 'bg-blue-500' },
  { label: 'Phòng sạch', dot: 'bg-yellow-400' },
  { label: 'Đã kiểm tra', dot: 'bg-green-500' },
  { label: 'Phòng sửa chữa (OOO)', dot: 'bg-slate-400' },
];

// 3 phòng Penthouse đặc biệt — chiếm 2 cột trong lưới sơ đồ, nội dung to hơn
const SPECIAL_ROOMS = ['777', '888', '999'];

interface RoomMapScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  staffList: string[];
}

export default function RoomMapScreen({ rooms, setRooms, staffList }: RoomMapScreenProps) {
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [aiSyncing, setAiSyncing] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const byFloor = rooms.reduce<Record<string, Room[]>>((acc, r) => {
    (acc[r.Tang] = acc[r.Tang] || []).push(r);
    return acc;
  }, {});
  const floors = Object.keys(byFloor).sort((a, b) => Number(a) - Number(b));

  const openModal = (room: Room) => setActiveRoom(room);
  const closeModal = () => setActiveRoom(null);

  const handleSave = async (maPhong: string, changes: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, ...changes } : r)));
    const fieldMap: Record<string, string> = {
      HkStatus: 'HkStatus', FoStatus: 'FoStatus',
      NhanVienPhuTrach: 'NhanVienPhuTrach', GhiChu: 'GhiChu', GhiChuNV: 'GhiChuNV', GhiChuAdmin: 'GhiChuAdmin', Flags: 'Flags',
    };
    for (const [key, value] of Object.entries(changes)) {
      if (fieldMap[key]) await updateRoomField(maPhong, fieldMap[key], String(value));
    }
  };

  const NHA_PHONG_TARGET_STATUSES = ['Phòng dơ', 'Phòng sạch', 'Phòng sửa chữa (OOO)'];
  const handleToggleInspecting = (maPhong: string, value: boolean) => {
    let newHkStatus: string | null = null;
    setRooms((prev) =>
      prev.map((r) => {
        if (r.MaPhong !== maPhong) return r;
        const hk = !value && NHA_PHONG_TARGET_STATUSES.includes(r.HkStatus) ? 'Đã kiểm tra' : r.HkStatus;
        if (hk !== r.HkStatus) newHkStatus = hk;
        return { ...r, HkStatus: hk, isInspecting: value };
      })
    );
    setActiveRoom((prev) => {
      if (!prev || prev.MaPhong !== maPhong) return prev;
      const hk = !value && NHA_PHONG_TARGET_STATUSES.includes(prev.HkStatus) ? 'Đã kiểm tra' : prev.HkStatus;
      return { ...prev, HkStatus: hk, isInspecting: value };
    });
    if (newHkStatus) updateRoomField(maPhong, 'HkStatus', newHkStatus);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiSyncing(true);
    setAiMessage('Đang đọc file PDF...');
    try {
      // BƯỚC 1 — AI đọc PDF, trả về danh sách trạng thái phòng mới nhất
      setAiMessage('AI đang phân tích trạng thái phòng...');
      const aiRooms = await readPdfWithAI(file);

      // BƯỚC 2 — Ghi đè lên Google Sheet theo từng lô, BẮT BUỘC xác nhận success:true
      // trước khi coi là hoàn tất. Nếu bất kỳ lô nào lỗi, dừng lại và báo rõ cho người dùng
      // thay vì âm thầm coi như thành công.
      setAiMessage('Đang ghi ' + aiRooms.length + ' phòng lên Google Sheet...');
      const chunkSize = 15;
      let totalUpdated = 0;
      const allNotFound: string[] = [];
      for (let i = 0; i < aiRooms.length; i += chunkSize) {
        const chunk = aiRooms.slice(i, i + chunkSize);
        const result = await bulkUpdateFromAI(chunk);
        if (!result || !result.success) {
          throw new Error(
            'Ghi lên Google Sheet thất bại ở lô phòng ' + (i + 1) + '-' + Math.min(i + chunkSize, aiRooms.length) +
            (result?.error ? ': ' + result.error : '')
          );
        }
        totalUpdated += result.updated || 0;
        if (result.notFound?.length) allNotFound.push(...result.notFound);
      }

      // BƯỚC 3 — Sheet đã xác nhận ghi xong -> tải lại dữ liệu CHUẨN từ Sheet để hiển thị,
      // không dùng dữ liệu AI cục bộ nữa (tránh lệch giữa UI và Sheet thật).
      setAiMessage('Đang tải lại dữ liệu chuẩn từ Google Sheet...');
      const freshRooms = await fetchRooms();
      setRooms(freshRooms);

      const notFoundNote = allNotFound.length ? ` (không tìm thấy phòng: ${allNotFound.join(', ')})` : '';
      setAiMessage(`✓ Hoàn tất! Đã cập nhật ${totalUpdated} phòng${notFoundNote}`);
      setTimeout(() => setAiSyncing(false), 1500);
    } catch (err: any) {
      setAiMessage('Lỗi: ' + err.message);
      setTimeout(() => setAiSyncing(false), 3500);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="text-[19px] font-bold">Sơ đồ phòng khách sạn</h1>
        <div className="flex items-center gap-3.5 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-[13px] font-bold text-blue-600 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> ĐỒNG BỘ AI
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
          <div className="flex gap-3.5 flex-wrap text-xs text-slate-500">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <i className={`w-2 h-2 rounded-full inline-block ${l.dot}`} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {floors.map((floor) => (
        <div key={floor}>
          <div className="text-xs font-bold tracking-wide text-slate-500 my-4">TẦNG {floor}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 md:gap-3">
            {byFloor[floor].map((room) => {
              const isSpecial = SPECIAL_ROOMS.includes(room.MaPhong);
              return (
                <div key={room.MaPhong} className={isSpecial ? 'col-span-2' : ''}>
                  <RoomCard room={room} onClick={() => openModal(room)} special={isSpecial} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <RoomModal
        room={activeRoom}
        onClose={closeModal}
        onSave={handleSave}
        onToggleInspecting={handleToggleInspecting}
        staffList={staffList}
      />

      {aiSyncing && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-[380px] rounded-2xl p-5 text-center">
            <h4 className="font-bold mb-2">Đang đồng bộ AI</h4>
            <div className="w-9 h-9 border-4 border-slate-200 border-t-blue-600 rounded-full mx-auto my-3.5 animate-spin" />
            <div className="text-[13px] text-slate-500">{aiMessage}</div>
          </div>
        </div>
      )}
    </>
  );
}
