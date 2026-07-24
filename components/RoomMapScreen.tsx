'use client';

import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Room } from '@/lib/types';
import RoomCard from '@/components/RoomCard';
import RoomModal from '@/components/RoomModal';
import { updateRoomField, bulkUpdateFromAI, readPdfWithAI } from '@/lib/api';

const LEGEND = [
  { label: 'Phòng dơ', dot: 'bg-red-500' },
  { label: 'Phòng đang dọn', dot: 'bg-blue-500' },
  { label: 'Phòng sạch', dot: 'bg-yellow-400' },
  { label: 'Đã kiểm tra', dot: 'bg-green-500' },
  { label: 'Phòng sửa chữa (OOO)', dot: 'bg-slate-400' },
];

interface RoomMapScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
}

export default function RoomMapScreen({ rooms, setRooms }: RoomMapScreenProps) {
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
      NhanVienPhuTrach: 'NhanVienPhuTrach', GhiChu: 'GhiChu', Flags: 'Flags',
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
      setAiMessage('AI đang phân tích trạng thái phòng...');
      const aiRooms = await readPdfWithAI(file);

      setAiMessage('Đang cập nhật ' + aiRooms.length + ' phòng...');
      setRooms((prev) =>
        prev.map((r) => {
          const item = aiRooms.find((a) => String(a.id) === String(r.MaPhong));
          if (!item) return r;
          return {
            ...r,
            HkStatus: item.hkStatus || r.HkStatus,
            FoStatus: item.foStatus || r.FoStatus,
            GhiChu: item.note || r.GhiChu,
          };
        })
      );

      const chunkSize = 15;
      for (let i = 0; i < aiRooms.length; i += chunkSize) {
        await bulkUpdateFromAI(aiRooms.slice(i, i + chunkSize));
      }
      setAiMessage('✓ Hoàn tất!');
      setTimeout(() => setAiSyncing(false), 900);
    } catch (err: any) {
      setAiMessage('Lỗi: ' + err.message);
      setTimeout(() => setAiSyncing(false), 2500);
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))] gap-2 md:gap-2.5">
            {byFloor[floor].map((room) => (
              <RoomCard key={room.MaPhong} room={room} onClick={() => openModal(room)} />
            ))}
          </div>
        </div>
      ))}

      <RoomModal
        room={activeRoom}
        onClose={closeModal}
        onSave={handleSave}
        onToggleInspecting={handleToggleInspecting}
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
