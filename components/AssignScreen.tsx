'use client';

import { useEffect, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, Printer, ChevronDown, Users, RefreshCw, Trash2, User, CheckCircle2, AlertCircle, Wrench, Star } from 'lucide-react';
import type { Room, Group } from '@/lib/types';
import { DEFAULT_ASSIGN_GROUPS } from '@/lib/types';
import { calculateWeightedCount, groupLabel, roomsForGroup, groupCurrentLabel } from '@/lib/assignHelpers';
import { NoteIcons, hasDndOrRf, combineNotes, checkLinenChange } from '@/lib/roomStyles';
import { updateRoomField, getAssignGroups, saveAssignGroups, fetchRooms } from '@/lib/api';

const HK_DOT: Record<string, string> = {
  'Phòng dơ': 'bg-red-500',
  'Phòng đang dọn': 'bg-blue-500',
  'Phòng sạch': 'bg-yellow-400',
  'Đã kiểm tra': 'bg-green-500',
  'Phòng sửa chữa (OOO)': 'bg-slate-400',
};

/* Mục 2 — badge viết tắt theo FO Status.
 * Theo yêu cầu UI mới: VD (Vacant), DO (Due out), DO/Arr (Due out/ARR) dùng CHUNG 1 nền đỏ ĐẬM,
 * nổi bật, dễ quan sát. Riêng ARR (Arrival): CHỈ đỏ đậm khi phòng ĐANG CÒN DƠ (HkStatus = "Phòng
 * dơ", tức khách sắp tới mà phòng chưa kịp dọn — cần chú ý gấp); nếu phòng đã dọn/sạch thì ARR vẫn
 * giữ màu xanh dương như cũ (xem logic động trong RoomChip bên dưới, không cố định ở bảng tĩnh này). */
const DARK_RED_BADGE = 'bg-red-700 text-white border border-red-800';
const ARR_BLUE_BADGE = 'bg-sky-50 text-sky-600 border border-sky-300';
const FO_BADGE: Record<string, { text: string; cls: string }> = {
  Occupied: { text: 'OD', cls: 'bg-red-50 text-red-600 border border-red-300' },
  'Due out': { text: 'DO', cls: DARK_RED_BADGE },
  Vacant: { text: 'VD', cls: DARK_RED_BADGE },
  'Due out/ARR': { text: 'DO/Arr', cls: DARK_RED_BADGE },
  Arrival: { text: 'ARR', cls: ARR_BLUE_BADGE },
};

/* Mục 4 — tông màu pastel riêng cho từng cột nhân viên, xoay vòng theo index */
const COLUMN_THEMES = [
  { bg: 'bg-blue-50/70', border: 'border-blue-200', header: 'bg-blue-100/80' },
  { bg: 'bg-emerald-50/70', border: 'border-emerald-200', header: 'bg-emerald-100/80' },
  { bg: 'bg-amber-50/70', border: 'border-amber-200', header: 'bg-amber-100/80' },
  { bg: 'bg-purple-50/70', border: 'border-purple-200', header: 'bg-purple-100/80' },
];

/* Mục 2.B — badge DND (đỏ) / RF (tím đậm) trong ghi chú, hiện đồng thời nếu có cả 2 */
function getLeftBadge(note: string) {
  const { dnd, rf } = hasDndOrRf(note);
  if (!dnd && !rf) return null;
  return (
    <span className="flex items-center gap-1">
      {dnd && <span className="bg-red-600 text-white font-extrabold px-1 rounded-sm text-[9px]">DND</span>}
      {rf && <span className="bg-purple-800 text-white font-extrabold px-1 rounded-sm text-[9px]">RF</span>}
    </span>
  );
}

interface AssignScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  /** Mục 3 — danh sách tên nhân viên lấy ĐỘNG từ tab TaiKhoan (page.tsx fetch qua listAccounts), không hardcode */
  staffList: string[];
}

export default function AssignScreen({ rooms, setRooms, staffList }: AssignScreenProps) {
  const [groups, setGroups] = useState<Group[]>(DEFAULT_ASSIGN_GROUPS);
  const [addStaffOpenFor, setAddStaffOpenFor] = useState<string | null>(null);
  const [taskModalGroupId, setTaskModalGroupId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  // Mục 1 — danh sách phòng đang được chọn (multi-select) trong kho chờ
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Nhóm phân công (N1-N5 + tên nhân viên) nay lưu trên Supabase — DÙNG CHUNG mọi thiết bị, không
  // còn riêng từng trình duyệt như localStorage trước đây. Đồng bộ AI tự reset bảng này NGAY TRÊN
  // SERVER (xem sbBulkUpdateRoomsFromAI) — màn này chỉ cần poll định kỳ để tự cập nhật theo, kể cả
  // khi lượt Đồng bộ AI được bấm từ MỘT THIẾT BỊ KHÁC (đây chính là lỗi cũ: trước đây chỉ máy nào
  // tự bấm Đồng bộ AI mới thấy Nhóm trống, các máy/trình duyệt khác vẫn còn tên nhân viên).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    const refreshGroups = () => { getAssignGroups().then((g) => { if (isMountedRef.current) setGroups(g); }).catch(() => {}); };
    refreshGroups();
    const timer = setInterval(refreshGroups, 20000);
    return () => { isMountedRef.current = false; clearInterval(timer); };
  }, []);

  // Kho phòng chờ CHỈ hiển thị phòng chưa được gán cho nhân viên nào
  // Fix: phòng chỉ tính là "đã gán" khi nhãn của nó khớp với 1 nhóm ĐANG TỒN TẠI.
  // Nếu nhóm bị xoá hoặc đổi thành phần (khiến nhãn cũ không còn khớp nhóm nào),
  // phòng đó tự động coi là chưa gán và quay lại kho chờ — không bị "biến mất".
  const activeGroupLabels = new Set(groups.map((g) => groupCurrentLabel(g)));
  const isUnassigned = (r: Room) => !r.NhanVienPhuTrach || !activeGroupLabels.has(r.NhanVienPhuTrach);
  const dirtyRooms = rooms.filter((r) => r.HkStatus === 'Phòng dơ' && isUnassigned(r));
  const cleanRooms = rooms.filter((r) => r.HkStatus !== 'Phòng dơ' && isUnassigned(r));

  // Mục 5 — Thanh tổng hợp trạng thái phòng (đặt cạnh nút IN TỔNG HỢP), tính trên TOÀN BỘ phòng
  // (không chỉ phòng chưa gán). 4 chỉ số theo chuẩn thuật ngữ buồng phòng:
  // OD (Occupied) / VD-DO gộp chung — "phòng khách trả" = TẤT CẢ các trạng thái Vacant, Due out,
  // Due out/ARR, Arrival mà CHƯA SẠCH (chưa dọn xong) đều tính vào đây, không chỉ riêng Vacant+Due
  // out như trước (trước đây bị thiếu DO/Arr và Arrival) / OOO (Phòng sửa chữa) / VC (Vacant Clean
  // — phòng trống ĐÃ sạch, sẵn sàng bán, không trùng với VD-DO).
  const statOD = rooms.filter((r) => r.FoStatus === 'Occupied').length;
  const NEEDS_TURNOVER_FO = ['Vacant', 'Due out', 'Due out/ARR', 'Arrival'];
  const statVD_DO = rooms.filter(
    (r) =>
      NEEDS_TURNOVER_FO.includes(r.FoStatus) &&
      r.HkStatus !== 'Phòng sạch' &&
      r.HkStatus !== 'Đã kiểm tra' &&
      r.HkStatus !== 'Phòng sửa chữa (OOO)'
  ).length;
  const statOOO = rooms.filter((r) => r.HkStatus === 'Phòng sửa chữa (OOO)').length;
  const statVC = rooms.filter(
    (r) => r.FoStatus === 'Vacant' && (r.HkStatus === 'Phòng sạch' || r.HkStatus === 'Đã kiểm tra')
  ).length;

  const toggleSelect = (maPhong: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(maPhong)) next.delete(maPhong);
      else next.add(maPhong);
      return next;
    });
  };

  const assignRooms = async (maPhongList: string[], group: Group) => {
    const label = groupCurrentLabel(group);
    setRooms((prev) => prev.map((r) => (maPhongList.includes(r.MaPhong) ? { ...r, NhanVienPhuTrach: label, TrolleyCode: group.id } : r)));
    await Promise.all(maPhongList.map((id) => Promise.all([
      updateRoomField(id, 'NhanVienPhuTrach', label),
      updateRoomField(id, 'TrolleyCode', group.id),
    ])));
  };

  const unassignRoom = async (maPhong: string) => {
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, NhanVienPhuTrach: '' } : r)));
    await updateRoomField(maPhong, 'NhanVienPhuTrach', '');
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId, source } = result;
    if (!destination) return;
    if (!destination.droppableId.startsWith('group-')) return;
    const groupId = destination.droppableId.replace('group-', '');
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const draggedId = draggableId.replace(/^pool-/, '').replace(/^assigned-[^-]+-/, '');

    // Mục 1 — nếu phòng đang kéo nằm trong danh sách đã chọn (>1 phòng) thì kéo cả nhóm chọn
    const fromPool = source.droppableId.startsWith('pool-');
    if (fromPool && selectedIds.has(draggedId) && selectedIds.size > 1) {
      assignRooms(Array.from(selectedIds), group);
      setSelectedIds(new Set());
    } else {
      assignRooms([draggedId], group);
    }
  };

  // Khi nhãn của 1 nhóm đổi (thêm/bớt nhân viên), toàn bộ phòng đang mang nhãn cũ
  // (kể cả nhãn tạm N1/N2... khi nhóm chưa có ai) được tự động chuyển sang nhãn mới —
  // để không mất phòng đã kéo trước khi gán tên nhân viên.
  const migrateAssignedRooms = async (oldLabel: string, newLabel: string) => {
    if (oldLabel === newLabel) return;
    const affected = rooms.filter((r) => r.NhanVienPhuTrach === oldLabel).map((r) => r.MaPhong);
    if (affected.length === 0) return;
    setRooms((prev) => prev.map((r) => (affected.includes(r.MaPhong) ? { ...r, NhanVienPhuTrach: newLabel } : r)));
    await Promise.all(affected.map((id) => updateRoomField(id, 'NhanVienPhuTrach', newLabel)));
  };

  // LÀM MỚI — CHỈ tải lại dữ liệu mới nhất từ Supabase (phòng + Nhóm) để đồng bộ giao diện,
  // KHÔNG xoá/sửa bất kỳ dữ liệu nào. An toàn bấm bất cứ lúc nào, không cần xác nhận.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const [freshRooms, freshGroups] = await Promise.all([fetchRooms(), getAssignGroups()]);
      setRooms(freshRooms);
      setGroups(freshGroups);
    } catch {
      // Lỗi mạng khi làm mới thì bỏ qua âm thầm, giữ nguyên dữ liệu đang hiện trên màn hình
    } finally {
      setIsRefreshing(false);
    }
  };

  // XÓA DỮ LIỆU — xoá TOÀN BỘ phân công phòng (mọi phòng quay về kho chờ) LẪN các nhóm/tên
  // nhân viên đã tạo (quay về danh sách nhóm mặc định). Đây là thao tác PHÁ HUỶ DỮ LIỆU, tách
  // RIÊNG hẳn khỏi nút "Làm mới" — chỉ chạy khi bấm ĐÚNG nút này VÀ xác nhận, không còn tự động
  // xảy ra khi làm mới/tải lại trang nữa (tránh mất sạch phân công ngoài ý muốn).
  const clearAllAssignments = async () => {
    const confirmed = window.confirm(
      'XOÁ DỮ LIỆU: xoá TOÀN BỘ phân công phòng và các nhóm/tên nhân viên đã tạo, quay về mặc định ban đầu?\n\nHành động này KHÔNG THỂ hoàn tác.'
    );
    if (!confirmed) return;
    const assignedIds = rooms.filter((r) => r.NhanVienPhuTrach).map((r) => r.MaPhong);
    setRooms((prev) => prev.map((r) => (assignedIds.includes(r.MaPhong) ? { ...r, NhanVienPhuTrach: '' } : r)));
    setGroups(DEFAULT_ASSIGN_GROUPS);
    setSelectedIds(new Set());
    await Promise.all([
      ...assignedIds.map((id) => updateRoomField(id, 'NhanVienPhuTrach', '')),
      saveAssignGroups(DEFAULT_ASSIGN_GROUPS),
    ]);
  };

  const handlePrintAll = () => window.print();

  // Mọi thay đổi Nhóm đều cập nhật state cục bộ NGAY (phản hồi tức thì) + lưu lên Supabase ngay sau
  // đó (dùng chung mọi thiết bị, không còn localStorage riêng từng máy).
  //
  // FIX LỖI "F5/Ctrl+R làm mất tên nhân viên trên Nhóm" — trước đây gọi saveAssignGroups kiểu
  // "bắn rồi quên" (không await, không kiểm tra kết quả). Nếu lần ghi đó âm thầm lỗi (mất mạng,
  // lỗi Supabase...), giao diện vẫn hiện ĐÚNG tạm thời vì đang đọc state cục bộ — nhưng dữ liệu
  // THỰC TẾ CHƯA được lưu lên server. Tới khi tải lại trang, màn Phân công đọc lại từ server và lộ
  // ra dữ liệu cũ/rỗng — trong khi tên nhân viên ở Sơ đồ phòng (field NhanVienPhuTrach riêng, lưu ở
  // bảng khác và LUÔN được await khi ghi) vẫn còn, gây cảm giác "data bị xoá sạch không đều nhau".
  // Nay BẮT BUỘC chờ kết quả ghi + báo lỗi rõ ràng ngay khi thất bại, không còn im lặng mất dữ liệu.
  const updateGroups = async (next: Group[]) => {
    setGroups(next);
    const res = await saveAssignGroups(next);
    if (!res.success) {
      window.alert(
        '⚠ KHÔNG lưu được thay đổi Nhóm phân công lên hệ thống (lỗi mạng hoặc server).\n\n' +
        'Thay đổi vừa rồi CHỈ đang hiện tạm trên máy này — nếu tải lại trang (F5) bây giờ sẽ bị mất. ' +
        'Chị kiểm tra lại mạng rồi thử thao tác lại, hoặc báo kỹ thuật nếu lỗi lặp lại nhiều lần.'
      );
    }
  };

  const addGroup = () => {
    const nums = groups.map((g) => Number(g.id.replace('N', '')) || 0);
    const nextId = 'N' + (Math.max(0, ...nums) + 1);
    updateGroups([...groups, { id: nextId, staffs: [], extraTasks: [] }]);
  };

  const removeGroup = (id: string) => updateGroups(groups.filter((g) => g.id !== id));

  const addStaffToGroup = (groupId: string, staff: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group || group.staffs.includes(staff)) { setAddStaffOpenFor(null); return; }
    const oldLabel = groupCurrentLabel(group);
    const updatedGroup = { ...group, staffs: [...group.staffs, staff] };
    const newLabel = groupCurrentLabel(updatedGroup);
    updateGroups(groups.map((g) => (g.id === groupId ? updatedGroup : g)));
    setAddStaffOpenFor(null);
    migrateAssignedRooms(oldLabel, newLabel);
  };

  const removeStaffFromGroup = (groupId: string, staff: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const oldLabel = groupCurrentLabel(group);
    const updatedGroup = { ...group, staffs: group.staffs.filter((s) => s !== staff) };
    const newLabel = groupCurrentLabel(updatedGroup);
    updateGroups(groups.map((g) => (g.id === groupId ? updatedGroup : g)));
    migrateAssignedRooms(oldLabel, newLabel);
  };

  const openTaskModal = (groupId: string) => { setTaskModalGroupId(groupId); setTaskDraft(''); };
  const submitTask = () => {
    if (!taskModalGroupId || !taskDraft.trim()) return;
    updateGroups(groups.map((g) => (g.id === taskModalGroupId ? { ...g, extraTasks: [...g.extraTasks, taskDraft.trim()] } : g)));
    setTaskModalGroupId(null);
  };
  const removeTask = (groupId: string, idx: number) => {
    updateGroups(groups.map((g) => (g.id === groupId ? { ...g, extraTasks: g.extraTasks.filter((_, i) => i !== idx) } : g)));
  };

  const RoomChip = ({
    room, removable, onRemove, selectable, selected, onToggleSelect,
  }: {
    room: Room; removable?: boolean; onRemove?: () => void;
    selectable?: boolean; selected?: boolean; onToggleSelect?: () => void;
  }) => {
    const combinedNote = combineNotes(room.GhiChu, room.GhiChuNV, room.GhiChuAdmin);
    // ARR + phòng còn dơ (chưa dọn) -> đỏ đậm (cần chú ý gấp); ARR + đã dọn/sạch -> giữ xanh dương.
    const fo = FO_BADGE[room.FoStatus]
      ? room.FoStatus === 'Arrival' && room.HkStatus === 'Phòng dơ'
        ? { ...FO_BADGE[room.FoStatus], cls: DARK_RED_BADGE }
        : FO_BADGE[room.FoStatus]
      : undefined;
    return (
    <div
      onClick={selectable ? onToggleSelect : undefined}
      className={`group relative flex items-center justify-between gap-2 bg-white border rounded-lg pl-2.5 pr-2 py-2 text-[12px] shadow-sm transition-all ${
        selectable ? 'cursor-pointer' : ''
      } ${selected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'border-slate-200 hover:border-slate-300'}`}
    >
      {/* Nút xoá — góc trên-phải thẻ, tinh tế (chỉ hiện rõ khi hover), không đè lên tên phòng/badge */}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          title="Bỏ phân công"
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-400 shadow-sm flex items-center justify-center text-[9px] font-bold leading-none opacity-0 group-hover:opacity-100 hover:text-red-600 hover:border-red-300 transition-opacity z-10"
        >
          ✕
        </button>
      )}

      {/* Trái: chấm status + badge DND/RF + số phòng + icon EB/BBC/HON (CHỈ 3 mã này, ẩn mọi ghi chú khác) */}
      <span className="flex items-center gap-1.5 font-semibold min-w-0">
        <i className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${HK_DOT[room.HkStatus] || 'bg-slate-300'}`} />
        {getLeftBadge(combinedNote)}
        <span className="truncate">{room.MaPhong} - {room.LoaiPhong}</span>
        <NoteIcons note={combinedNote} ngayO={room.NgayO} />
      </span>

      {/* Phải: badge trạng thái FO (OD/DO/VD/ARR/DO-Arr) — đẩy sát mép phải, căn đều trên mọi thẻ.
          Riêng OD mà HÔM NAY đến lịch thay ga giường (checkLinenChange) -> thêm icon sao vàng nhỏ
          ngay sát chữ OD, để nhân viên biết cần mang ga/gối mới khi vào dọn phòng này. */}
      {fo && (
        <span className={`flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ml-auto whitespace-nowrap ${fo.cls}`}>
          {fo.text}
          {room.FoStatus === 'Occupied' && checkLinenChange(room) && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          )}
        </span>
      )}
    </div>
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h1 className="text-[19px] font-bold">Phân công dọn phòng</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mục 5 — thanh tổng hợp trạng thái phòng, đặt cạnh nút IN TỔNG HỢP.
              Nền SÁNG + mỗi chỉ số có màu riêng nổi bật. Theo yêu cầu mới: chỉ 4 chỉ số chuẩn
              thuật ngữ buồng phòng — OD / VD-DO (gộp) / OOO / VC — xếp 1 dòng duy nhất. */}
          <div className="flex items-center gap-3 bg-white/95 text-slate-800 border border-slate-200 shadow-md rounded-2xl p-3 text-[11px] font-semibold leading-none backdrop-blur-sm">
            <span className="flex items-center gap-1 whitespace-nowrap text-red-600">
              <User className="w-3 h-3" />{statOD} OD
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-orange-500">
              <AlertCircle className="w-3 h-3" />{statVD_DO} VD/DO
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-slate-500">
              <Wrench className="w-3 h-3" />{statOOO} OOO
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap text-emerald-600">
              <CheckCircle2 className="w-3 h-3" />{statVC} VC
            </span>
          </div>
          <button
            onClick={handlePrintAll}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 rounded-lg px-3 py-2"
          >
            <Printer className="w-3.5 h-3.5" /> IN TỔNG HỢP
          </button>
          {/* LÀM MỚI — chỉ tải lại dữ liệu mới nhất, KHÔNG xoá gì cả, bấm thoải mái không lo mất phân công */}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> LÀM MỚI
          </button>
          {/* XÓA DỮ LIỆU — thao tác phá huỷ, tách riêng khỏi Làm mới, luôn có xác nhận trước khi xoá */}
          <button
            onClick={clearAllAssignments}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 rounded-lg px-3 py-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> XÓA DỮ LIỆU
          </button>
        </div>
      </div>

      <div className="mb-2 text-[13px] font-bold text-red-600 flex items-center justify-between">
        Phòng cần dọn (Dirty) <span className="text-slate-400 font-normal text-xs">{dirtyRooms.length} phòng</span>
      </div>
      <Droppable droppableId="pool-dirty" isDropDisabled direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-2 mb-5">
            {dirtyRooms.map((room, i) => (
              <Draggable key={room.MaPhong} draggableId={`pool-${room.MaPhong}`} index={i}>
                {(p) => (
                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="w-[150px]">
                    <RoomChip room={room} selectable selected={selectedIds.has(room.MaPhong)} onToggleSelect={() => toggleSelect(room.MaPhong)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="mb-2 text-[13px] font-bold text-slate-600 flex items-center justify-between">
        Phòng đã sạch <span className="text-slate-400 font-normal text-xs">{cleanRooms.length} phòng</span>
      </div>
      <Droppable droppableId="pool-clean" isDropDisabled direction="horizontal">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-2 mb-6">
            {cleanRooms.map((room, i) => (
              <Draggable key={room.MaPhong} draggableId={`pool-${room.MaPhong}`} index={i}>
                {(p) => (
                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="w-[150px]">
                    <RoomChip room={room} selectable selected={selectedIds.has(room.MaPhong)} onToggleSelect={() => toggleSelect(room.MaPhong)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {selectedIds.size > 0 && (
        <div className="mb-4 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
          Đã chọn {selectedIds.size} phòng — kéo 1 phòng bất kỳ trong số đó vào cột nhân viên để gán cả loạt
          <button onClick={() => setSelectedIds(new Set())} className="text-blue-500 underline">Bỏ chọn</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-slate-200">
        <span className="text-xs font-bold text-slate-500">NHÓM:</span>
        <button onClick={addGroup} className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
          <Plus className="w-3.5 h-3.5" />
        </button>
        {groups.map((g) => (
          <div key={g.id} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-xs font-bold text-blue-700">{g.id}</span>
            {g.staffs.map((s) => (
              <span key={s} className="flex items-center gap-0.5 bg-blue-600 text-white text-[11px] font-semibold rounded px-1.5 py-0.5">
                {s}
                <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => removeStaffFromGroup(g.id, s)} />
              </span>
            ))}
            <div className="relative">
              <button
                onClick={() => setAddStaffOpenFor(addStaffOpenFor === g.id ? null : g.id)}
                className="flex items-center gap-0.5 text-[11px] text-slate-500 border border-slate-300 rounded px-1.5 py-0.5"
              >
                + Thêm <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {addStaffOpenFor === g.id && (
                <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-28 max-h-48 overflow-y-auto">
                  {staffList.filter((s) => !g.staffs.includes(s)).map((s) => (
                    <div key={s} onClick={() => addStaffToGroup(g.id, s)} className="px-3 py-1.5 text-xs hover:bg-slate-50 cursor-pointer">
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <X className="w-3 h-3 text-slate-300 cursor-pointer ml-1" onClick={() => removeGroup(g.id)} />
          </div>
        ))}
      </div>

      <div
        className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:[grid-template-columns:repeat(var(--ncols),minmax(220px,1fr))]"
        style={{ ['--ncols' as any]: Math.max(groups.length, 1) }}
      >
        {groups.map((g, idx) => {
          const myRooms = roomsForGroup(rooms, g);
          const weighted = calculateWeightedCount(myRooms.map((r) => r.MaPhong));
          const theme = COLUMN_THEMES[idx % COLUMN_THEMES.length];
          return (
            <div key={g.id} className={`border rounded-xl flex flex-col overflow-hidden ${theme.bg} ${theme.border}`}>
              <div className={`flex items-center justify-between px-3 py-2.5 border-b ${theme.border} ${theme.header}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                  <span className="font-bold text-sm truncate">{groupLabel(g) || g.id}</span>
                  {/* Mục 4 — số phòng đỏ nổi bật, đậm */}
                  <span className="text-red-600 font-extrabold text-sm whitespace-nowrap">({weighted} phòng)</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Printer className="w-3.5 h-3.5 text-slate-500 cursor-pointer" onClick={() => window.print()} />
                  <button
                    onClick={() => openTaskModal(g.id)}
                    className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center"
                    title="Thêm nhiệm vụ khác"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <Droppable droppableId={`group-${g.id}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-1.5 min-h-[80px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/70' : ''}`}
                  >
                    {myRooms.map((room, i) => (
                      <Draggable key={room.MaPhong} draggableId={`assigned-${g.id}-${room.MaPhong}`} index={i}>
                        {(p) => (
                          <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}>
                            <RoomChip room={room} removable onRemove={() => unassignRoom(room.MaPhong)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {g.extraTasks.map((task, idx2) => (
                      <div key={idx2} className="flex items-start justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-2 text-[11px] text-yellow-800">
                        <span>📋 {task}</span>
                        <X className="w-3 h-3 cursor-pointer flex-shrink-0 mt-0.5" onClick={() => removeTask(g.id, idx2)} />
                      </div>
                    ))}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>

      {taskModalGroupId && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-[380px] rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-[16px]">Nhiệm vụ khác</h4>
              <X className="w-4 h-4 cursor-pointer text-slate-500" onClick={() => setTaskModalGroupId(null)} />
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">
              Nhóm: {groupLabel(groups.find((g) => g.id === taskModalGroupId)!) || taskModalGroupId}
            </div>
            <textarea
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              placeholder="Nhập nội dung nhiệm vụ phụ (Ví dụ: Lau cửa kính sảnh, Trực kho...)"
              className="w-full min-h-[90px] border border-slate-200 rounded-lg p-3 text-sm resize-y mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setTaskModalGroupId(null)} className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-bold text-slate-600">
                HỦY
              </button>
              <button onClick={submitTask} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-bold">
                THÊM NHIỆM VỤ
              </button>
            </div>
          </div>
        </div>
      )}
    </DragDropContext>
  );
}
