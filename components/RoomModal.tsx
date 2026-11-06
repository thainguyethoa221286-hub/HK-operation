'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Users, User, ChevronDown, Search, Check, Pencil } from 'lucide-react';
import type { Room, HkStatus, FoStatus, Account } from '@/lib/types';
import { HK_STATUSES, FO_STATUSES, FLAGS } from '@/lib/types';
import { formatDateShort, removeNoteCode, combineNotes, hasDndOrRf, nowTimeStr, isLongStay, LinenChangeBadge, ROOM_GROUP_CODES, ROOM_GROUP_TONE, getRoomGroup, withRoomGroup } from '@/lib/roomStyles';
import { createMaintenanceIssue, logTaskAction } from '@/lib/api';

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
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
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
  // Giá trị LÚC MỞ bảng — khi đóng chỉ lưu những ô giám sát THẬT SỰ đổi. Trước đây lưu lại TOÀN BỘ
  // (kể cả Tình trạng phòng) -> nếu bảng mở từ trước khi nhân viên bấm Hoàn thành, lúc đóng sẽ ghi đè
  // "Phòng sạch" về lại "Phòng dơ" cũ => Sơ đồ báo dơ trong khi thẻ nhân viên báo Đã dọn.
  const initRef = useRef({ hk: '', fo: '', staff: '', note: '', repairNote: '', flags: '' });

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
    initRef.current = {
      hk: room.HkStatus, fo: room.FoStatus, staff: room.NhanVienPhuTrach || '', note: room.GhiChuAdmin || '',
      repairNote: room.GhiChuSuaChua || '', flags: f.join(','),
    };
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

    // Ghi lịch sử MỖI LẦN BẬT MKR (TẮT -> BẬT trong phiên này) kèm giờ bấm + người bật — để Báo cáo
    // ngày đếm đủ số lần khách treo bảng MKR (giống DND/RF), tiện đối soát khi có sự cố.
    if (flags.includes('TrangDiem') && !initialFlags.includes('TrangDiem')) {
      logTaskAction(room.MaPhong, account?.hoTen || 'Giám sát', 'MKR Bật').catch(() => {});
    }

    // Bật cờ MKR — DND/RF đã hết hiệu lực (phòng cần trang điểm/chuẩn bị, không còn từ chối/không làm phiền
    // nữa), tự động gỡ mã DND/RF khỏi CẢ 3 nguồn ghi chú để hết hẳn badge, không chỉ ẩn ở 1 chỗ.
    const init = initRef.current;
    const changes: Partial<Room> = {};
    if (hk !== init.hk) changes.HkStatus = hk;
    if (fo !== init.fo) changes.FoStatus = fo;
    if (staff !== init.staff) changes.NhanVienPhuTrach = staff;
    if (note !== init.note) changes.GhiChuAdmin = note;
    if (repairNote !== init.repairNote) changes.GhiChuSuaChua = repairNote;
    if (flags.join(',') !== init.flags) changes.Flags = flags.join(',');
    // Chỉ khi VỪA BẬT MKR trong phiên này mới gỡ DND/RF (tránh ghi đè ghi chú cũ mỗi lần đóng bảng)
    if (flags.includes('TrangDiem') && !initialFlags.includes('TrangDiem')) {
      const strip = (s: string) => removeNoteCode(removeNoteCode(s, 'DND'), 'RF');
      changes.GhiChu = strip(room.GhiChu || '');
      changes.GhiChuNV = strip(room.GhiChuNV || '');
      changes.GhiChuAdmin = strip(note);
      // Khách đã treo MKR (yêu cầu dọn) — nếu nhân viên trước đó đã báo phòng DND / Từ chối (RF),
      // tự động TRẢ PHÒNG VỀ "Chưa dọn" để thẻ ở màn Nhiệm vụ của nhân viên quay lại thẻ trắng
      // (hết cửa xám DND/RF) và treo bảng MKR, nhân viên vào dọn được ngay.
      if (room.TaskStatus === 'DND' || room.TaskStatus === 'Refused') {
        changes.TaskStatus = 'Chưa dọn';
        changes.StartTime = '';
      }
    }

    // ĐỒNG BỘ VỚI NHÂN VIÊN: giám sát ghi DND / RF vào ghi chú -> làm y hệt lúc nhân viên bấm nút ở thẻ Nhiệm vụ:
    // đổi trạng thái DND / Từ chối (thẻ nhân viên chuyển cửa xám), gỡ RUSH/MKR, ghi giờ vào Daily Report.
    // Giám sát XOÁ mã DND/RF khỏi ghi chú -> trả phòng về "Chưa dọn". (Vừa bật MKR thì MKR được ưu tiên.)
    const mkrJustOn = flags.includes('TrangDiem') && !initialFlags.includes('TrangDiem');
    if (!mkrJustOn && note !== init.note) {
      const who = account?.hoTen || 'Giám sát';
      const before = hasDndOrRf(combineNotes(room.GhiChu, room.GhiChuNV, init.note));
      const after = hasDndOrRf(combineNotes(room.GhiChu, room.GhiChuNV, note));
      const noRushMkr = () => flags.filter((f) => f !== 'CayBac' && f !== 'TrangDiem').join(',');
      if (after.dnd && !before.dnd && room.TaskStatus !== 'DND') {
        changes.TaskStatus = 'DND';
        changes.GhiChuAdmin = removeNoteCode(note, 'RF');
        changes.GhiChuNV = removeNoteCode(room.GhiChuNV || '', 'RF');
        changes.Flags = noRushMkr();
        logTaskAction(room.MaPhong, who, 'DND Bật').catch(() => {});
      } else if (after.rf && !before.rf && room.TaskStatus !== 'Refused') {
        changes.TaskStatus = 'Refused';
        changes.StartTime = nowTimeStr();
        changes.GhiChuAdmin = removeNoteCode(note, 'DND');
        changes.GhiChuNV = removeNoteCode(room.GhiChuNV || '', 'DND');
        changes.Flags = noRushMkr();
        logTaskAction(room.MaPhong, who, 'Từ chối (RF)').catch(() => {});
      } else if (before.dnd && !after.dnd && room.TaskStatus === 'DND') {
        changes.TaskStatus = 'Chưa dọn';
        logTaskAction(room.MaPhong, who, 'DND Tắt').catch(() => {});
      } else if (before.rf && !after.rf && room.TaskStatus === 'Refused') {
        changes.TaskStatus = 'Chưa dọn';
        changes.StartTime = '';
        logTaskAction(room.MaPhong, who, 'Làm lại phòng').catch(() => {});
      }
    }

    if (Object.keys(changes).length > 0) onSave(room.MaPhong, changes);
    onClose();
  };

  // Màu ô "Tình trạng phòng" (chấm trạng thái + nền + viền) đổi theo đúng HkStatus đang chọn
  const hkTone = HK_TONE[hk] ?? HK_TONE['Phòng dơ'];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div
        className="bg-white w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.35)] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-1 overflow-y-auto scrollbar-none">
          {/* Header */}
          <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xl font-bold text-slate-800">Phòng {room.MaPhong}</h4>
                {showLsg && (
                  <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded-md text-xs shadow-sm">
                    LSG
                  </span>
                )}
                <LinenChangeBadge room={room} />
              </div>
              <div className="flex items-center gap-1.5 text-[13px] text-slate-500 mt-0.5">
                <span>{room.LoaiPhong} • {formatDateShort(room.NgayO) || '—'}</span>
                {/* NHÓM ĐI CÙNG — nút nhỏ thay chỗ icon lịch (dưới số phòng); bấm mới xổ ra A–F để chọn (gọn bảng giám sát).
                    Giữ qua Đồng bộ AI mỗi sáng, tự bỏ khi phòng thành Vacant. */}
                <div className="relative">
                  {(() => {
                    const cur = getRoomGroup(flags);
                    const tone = cur ? ROOM_GROUP_TONE[cur] : null;
                    return (
                      <button
                        type="button"
                        onClick={() => setGroupMenuOpen((v) => !v)}
                        aria-expanded={groupMenuOpen}
                        title="Nhóm đi cùng"
                        className={`flex items-center gap-1 rounded-full text-[11px] font-extrabold px-2 py-1 border transition ${
                          tone ? `${tone.solid} border-transparent shadow-sm` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" strokeWidth={2.5} />
                        {cur || 'Nhóm'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${groupMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    );
                  })()}
                  {groupMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setGroupMenuOpen(false)} />
                      <div className="absolute left-0 top-full mt-1.5 z-30 w-[236px] rounded-xl bg-white border border-slate-200 shadow-xl p-2.5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Nhóm đi cùng</div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setFlags((prev) => withRoomGroup(prev, '')); setGroupMenuOpen(false); }}
                            className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold border ${
                              !getRoomGroup(flags) ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            Không
                          </button>
                          {ROOM_GROUP_CODES.map((c) => {
                            const t = ROOM_GROUP_TONE[c];
                            const active = getRoomGroup(flags) === c;
                            return (
                              <button
                                type="button"
                                key={c}
                                onClick={() => { setFlags((prev) => withRoomGroup(prev, c)); setGroupMenuOpen(false); }}
                                aria-pressed={active}
                                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold border active:scale-95 transition ${
                                  active ? `${t.solid} border-transparent ring-2 ring-offset-1 ${t.ring}` : t.soft
                                }`}
                              >
                                <Users className="w-3 h-3" strokeWidth={2.75} /> {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Đóng"
              className="w-9 h-9 -mr-1.5 -mt-1 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tình trạng phòng + Trạng thái khách */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Tình trạng phòng
              </label>
              <div className={`relative rounded-2xl border ${hkTone.box}`}>
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${hkTone.dot}`} />
                <select
                  value={hk}
                  onChange={(e) => setHk(e.target.value as HkStatus)}
                  className="w-full appearance-none bg-transparent rounded-2xl pl-8 pr-8 py-2.5 text-[13px] font-semibold text-slate-800 outline-none cursor-pointer truncate"
                >
                  {HK_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>
            <div className="min-w-0">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Trạng thái khách
              </label>
              <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <select
                  value={fo}
                  onChange={(e) => setFo(e.target.value as FoStatus)}
                  className="w-full appearance-none bg-transparent rounded-2xl pl-9 pr-8 py-2.5 text-[13px] font-semibold text-slate-800 outline-none cursor-pointer truncate"
                >
                  {FO_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Gán nhân viên — khung nét đứt pastel; vẫn là ô chọn thả xuống như hiện tại (không đổi cách gán) */}
          <div className="relative flex items-center gap-2.5 border border-dashed border-indigo-200 rounded-2xl bg-indigo-50/40 hover:bg-indigo-50/70 transition px-3 py-2.5 mb-4">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="flex-1 min-w-0 appearance-none bg-transparent font-semibold text-sm text-slate-800 outline-none cursor-pointer pr-7"
            >
              <option value="">— Chưa gán —</option>
              {staffList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          </div>

          {/* Lưới Điều phối 4 ô */}
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Điều phối</div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {FLAGS.map((f) => {
              const active = flags.includes(f.key);
              const tone = FLAG_TONE[f.key];
              return (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => (f.key === 'DaOut' ? handleDaOut() : toggleFlag(f.key))}
                  className={`relative rounded-2xl px-1 py-3 text-center text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                    active ? `${tone.active} shadow-md` : `${tone.idle} shadow-[0_2px_6px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:shadow-md`
                  }`}
                >
                  {active && (
                    <span className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center ${tone.dot}`}>
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />
                    </span>
                  )}
                  <span className="block text-[22px] leading-none mb-1.5">{f.icon}</span>
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Ô Ghi chú Sửa chữa RIÊNG — chỉ hiện khi cờ "Sửa chữa" đang bật, tách biệt hoàn toàn
              khỏi Ghi chú nhân viên/giám sát. Nội dung này tự đổ sang Module Maintenance khi Đóng. */}
          {isRepairActive && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 mb-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase mb-2">
                🔧 Ghi chú sửa chữa
              </div>
              <textarea
                value={repairNote}
                onChange={(e) => setRepairNote(e.target.value)}
                placeholder="Mô tả sự cố cần sửa (VD: AC ồn, cửa bị cứng...)"
                className="w-full min-h-[60px] border border-orange-200 rounded-xl p-2.5 text-sm resize-y bg-white"
              />
            </div>
          )}

          {/* Mục 3 — Logic tương tác Kiểm phòng / Nhả phòng (isInspecting) */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => onToggleInspecting(room.MaPhong, true)}
              disabled={room.isInspecting}
              className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-bold bg-amber-100/80 text-amber-800 hover:bg-amber-100 active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
            >
              <Search className="w-4 h-4" strokeWidth={2.5} /> KIỂM PHÒNG
            </button>
            <button
              onClick={() => onToggleInspecting(room.MaPhong, false)}
              disabled={!room.isInspecting}
              className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-bold bg-emerald-100/70 text-emerald-800 hover:bg-emerald-100 active:scale-[0.98] transition disabled:opacity-40 disabled:active:scale-100"
            >
              <Check className="w-4 h-4" strokeWidth={2.75} /> NHẢ PHÒNG
            </button>
          </div>

          {/* Ghi chú GỐC do AI (room.GhiChu) — chỉ đọc, để đối chiếu khi thấy badge EB/BBC/HON/LSG lạ */}
          {room.GhiChu && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase flex-shrink-0 mt-0.5">Dữ liệu gốc (AI):</span>
              <span className="text-[13px] font-semibold text-slate-700">{room.GhiChu}</span>
            </div>
          )}

          {/* Ghi chú nhân viên tự gõ — chỉ đọc, giám sát cần thấy được */}
          {room.GhiChuNV && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-3">
              <span className="text-[10px] font-bold text-blue-500 uppercase flex-shrink-0 mt-0.5">Nhân viên ghi:</span>
              <span className="text-[13px] font-semibold text-blue-900">{room.GhiChuNV}</span>
            </div>
          )}

          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Ghi chú cho nhân viên</div>
          <div className="relative mb-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Khách hàng cần thêm gối..."
              className="w-full min-h-[88px] bg-white border border-slate-200 rounded-2xl p-3 pr-9 text-sm resize-none shadow-[0_2px_6px_rgba(15,23,42,0.06)] outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition"
            />
            <Pencil className="pointer-events-none absolute right-3 bottom-3.5 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 pt-3 pb-5 flex-shrink-0">
          <button
            onClick={handleClose}
            className="w-full bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-white rounded-2xl py-4 text-[15px] font-bold tracking-wider transition"
          >
            ĐÓNG
          </button>
        </div>
      </div>
    </div>
  );
}

/** Màu ô "Tình trạng phòng" theo HkStatus — khớp đúng bảng màu viền thẻ phòng (viết đủ tên class cho Tailwind) */
const HK_TONE: Record<string, { box: string; dot: string }> = {
  'Phòng dơ': { box: 'bg-red-50/60 border-red-300', dot: 'bg-red-500' },
  'Phòng đang dọn': { box: 'bg-blue-50/60 border-blue-300', dot: 'bg-blue-500' },
  'Phòng sạch': { box: 'bg-amber-50/60 border-amber-300', dot: 'bg-amber-400' },
  'Đã kiểm tra': { box: 'bg-emerald-50/60 border-emerald-300', dot: 'bg-emerald-500' },
  'Phòng sửa chữa (OOO)': { box: 'bg-slate-50 border-slate-300', dot: 'bg-slate-400' },
};

/** Màu từng ô Điều phối: idle = trạng thái chưa bật, active = đang bật (kèm dấu ✓ góc phải) */
const FLAG_TONE: Record<string, { idle: string; active: string; dot: string }> = {
  CayBac: { idle: 'bg-rose-50 text-red-600 border border-rose-100', active: 'bg-rose-100 text-red-700 ring-2 ring-rose-400', dot: 'bg-rose-500' },
  TrangDiem: { idle: 'bg-white text-slate-700 border border-slate-100', active: 'bg-blue-50 text-blue-700 ring-2 ring-blue-400', dot: 'bg-blue-500' },
  DaOut: { idle: 'bg-white text-slate-700 border border-slate-100', active: 'bg-sky-50 text-sky-700 ring-2 ring-sky-400', dot: 'bg-sky-500' },
  SuaChua: { idle: 'bg-white text-slate-700 border border-slate-100', active: 'bg-orange-50 text-orange-700 ring-2 ring-orange-400', dot: 'bg-orange-500' },
};
