'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X, Printer, ChevronDown, Users, RefreshCw, Trash2, User, CheckCircle2, AlertCircle, Wrench, Leaf, Moon, ArrowRight, Check } from 'lucide-react';
import type { Room, Group } from '@/lib/types';
import TrolleyBadge from './TrolleyBadge';
import { DEFAULT_ASSIGN_GROUPS } from '@/lib/types';
import { calculateWeightedCount, groupLabel, roomsForGroup, groupCurrentLabel, PM_GROUP_ID, PM_MOVE_ACTION, emptyPmGroup, isPmLabel, displayLabel, labelNames } from '@/lib/assignHelpers';
import { NoteIcons, hasDndOrRf, combineNotes, checkLinenChange, removeNoteCode, formatTimeOnly, RoomGroupBadge } from '@/lib/roomStyles';
import { updateRoomField, updateRoomFields, getAssignGroups, saveAssignGroups, fetchRooms, getTodayHistory, logTaskAction } from '@/lib/api';

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
// Phòng trống đã sạch -> VC VÀNG; đã kiểm tra -> VCI XANH LÁ (cùng màu trạng thái ở Sơ đồ phòng)
const VC_BADGE = 'bg-amber-100 text-amber-800 border border-amber-400';
const VCI_BADGE = 'bg-emerald-100 text-emerald-800 border border-emerald-400';
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
/** Đầu thẻ phòng ở bảng Phân công: phòng DND / RF thay chấm màu bằng BIỂN CẤM TRÒN (không hiện chữ).
 *  - DND: tròn ĐỎ, gạch ngang trắng (biển "cấm vào")
 *  - RF : tròn TÍM, dấu ✕ trắng
 *  Phòng bình thường giữ chấm màu theo Tình trạng phòng như cũ. */
function StatusSign({ note, hkStatus, noDot }: { note: string; hkStatus: string; noDot?: boolean }) {
  const { dnd, rf } = hasDndOrRf(note);
  // Danh sách phòng chưa chọn: bỏ chấm tròn trạng thái (đã tách ô Dơ / Sạch) — CHỈ giữ biển DND/RF
  if (noDot && !dnd && !rf) return null;
  // Ô CỐ ĐỊNH 12px cho MỌI thẻ -> số phòng luôn bắt đầu cùng 1 vị trí, các thẻ thẳng hàng
  return (
    <span className="w-3 h-3 flex items-center justify-center flex-shrink-0">
      {dnd ? (
        <span title="DND — Không làm phiền" className="w-3 h-3 rounded-full bg-red-600 flex items-center justify-center">
          <span className="block w-[7px] h-[2px] rounded-full bg-white" />
        </span>
      ) : rf ? (
        <span title="RF — Khách từ chối dọn" className="w-3 h-3 rounded-full bg-purple-700 flex items-center justify-center">
          <svg viewBox="0 0 10 10" className="w-[7px] h-[7px]" aria-hidden="true">
            <path d="M2 2l6 6M8 2L2 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <i className={`w-2 h-2 rounded-full inline-block ${HK_DOT[hkStatus] || 'bg-slate-300'}`} />
      )}
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
  const [groupCountOpen, setGroupCountOpen] = useState(false);
  const [groupCountPick, setGroupCountPick] = useState(0);

  // Nhóm phân công (N1-N5 + tên nhân viên) nay lưu trên Supabase — DÙNG CHUNG mọi thiết bị, không
  // còn riêng từng trình duyệt như localStorage trước đây. Đồng bộ AI tự reset bảng này NGAY TRÊN
  // SERVER (xem sbBulkUpdateRoomsFromAI) — màn này chỉ cần poll định kỳ để tự cập nhật theo, kể cả
  // khi lượt Đồng bộ AI được bấm từ MỘT THIẾT BỊ KHÁC (đây chính là lỗi cũ: trước đây chỉ máy nào
  // tự bấm Đồng bộ AI mới thấy Nhóm trống, các máy/trình duyệt khác vẫn còn tên nhân viên).
  const isMountedRef = useRef(true);
  // PM SHIFT — lịch sử "Chuyển PM Shift" trong ngày: mã phòng -> "DND · Tâm" + giờ chuyển
  const [pmMoves, setPmMoves] = useState<Record<string, { info: string; time: string }>>({});
  const [pmSelected, setPmSelected] = useState<Set<string>>(new Set());
  const [pmPushing, setPmPushing] = useState(false);
  const loadPmMoves = () => {
    getTodayHistory()
      .then((hs) => {
        if (!isMountedRef.current) return;
        const m: Record<string, { info: string; time: string }> = {};
        hs.forEach((h) => { if (h.hanhDong === PM_MOVE_ACTION) m[h.maPhong] = { info: h.chiTiet, time: formatTimeOnly(h.gio) }; });
        setPmMoves(m);
      })
      .catch(() => {});
  };
  useEffect(() => {
    isMountedRef.current = true;
    const refreshGroups = () => {
      getAssignGroups().then((g) => { if (isMountedRef.current) setGroups(g); }).catch(() => {});
      loadPmMoves();
    };
    refreshGroups();
    const timer = setInterval(refreshGroups, 20000);
    return () => { isMountedRef.current = false; clearInterval(timer); };
  }, []);

  // Kho phòng chờ CHỈ hiển thị phòng chưa được gán cho nhân viên nào
  // Fix: phòng chỉ tính là "đã gán" khi nhãn của nó khớp với 1 nhóm ĐANG TỒN TẠI.
  // Nếu nhóm bị xoá hoặc đổi thành phần (khiến nhãn cũ không còn khớp nhóm nào),
  // phòng đó tự động coi là chưa gán và quay lại kho chờ — không bị "biến mất".
  // Thẻ PM Shift luôn có (kể cả khi Đồng bộ AI / Xoá dữ liệu đã reset bảng Nhóm về mặc định)
  // Nếu bảng Nhóm bị ghi đè mất tên ca chiều (Đồng bộ AI reset, máy khác đang mở bản cũ...)
  // -> tự khôi phục tên từ chính các phòng đang mang nhãn "PM:Tên" — phòng đã đẩy không bao giờ "mất".
  const storedPm = groups.find((g) => g.id === PM_GROUP_ID);
  const pmLabelOnRooms = rooms.find((r) => (r.NhanVienPhuTrach || '').startsWith('PM:'))?.NhanVienPhuTrach || '';
  const pmGroup: Group =
    storedPm && storedPm.staffs.length > 0
      ? storedPm
      : pmLabelOnRooms
      ? { id: PM_GROUP_ID, staffs: labelNames(pmLabelOnRooms), extraTasks: storedPm?.extraTasks || [] }
      : storedPm || emptyPmGroup();
  const normalGroups = groups.filter((g) => g.id !== PM_GROUP_ID);
  const groupsWithPm = groups.some((g) => g.id === PM_GROUP_ID)
    ? groups.map((g) => (g.id === PM_GROUP_ID ? pmGroup : g))
    : [...groups, pmGroup];
  const activeGroupLabels = new Set(groupsWithPm.map((g) => groupCurrentLabel(g)));
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

  // Gán bằng BẤM (không kéo thả): chọn các phòng ở kho chờ -> bấm vào nhóm (N1, N2...) để gán cả loạt
  const assignSelectedTo = (group: Group) => {
    if (selectedIds.size === 0) return;
    assignRooms(Array.from(selectedIds), group);
    setSelectedIds(new Set());
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

  /* ===== PM SHIFT — đẩy phòng DND / RF còn lại của ca sáng sang ca chiều =====
     Phòng chuyển sang tên nhân viên ca chiều ("PM:Hoà"), trở về "Chưa dọn" để mở thẻ phòng làm bình thường.
     Ghi 1 dòng lịch sử "Chuyển PM Shift" (VD "DND · Tâm") -> Daily Report ghi lại được. */
  const pmLabel = groupCurrentLabel(pmGroup);
  const pmRooms = roomsForGroup(rooms, pmGroup).sort((a, b) => Number(a.MaPhong) - Number(b.MaPhong));
  // Phòng DND / RF: theo trạng thái nhiệm vụ HOẶC bảng treo trên ghi chú (ghi chú AI / nhân viên / giám sát)
  // — giống cách thẻ phòng hiện bảng DND/RF. Bỏ qua phòng đã dọn xong và phòng đã giao ca chiều.
  const pmKind = (r: Room): 'DND' | 'RF' | '' => {
    if (r.TaskStatus === 'DND') return 'DND';
    if (r.TaskStatus === 'Refused') return 'RF';
    const { dnd, rf } = hasDndOrRf(combineNotes(r.GhiChu, r.GhiChuNV, r.GhiChuAdmin));
    return dnd ? 'DND' : rf ? 'RF' : '';
  };
  const pmCandidates = rooms
    .filter((r) => pmKind(r) !== '' && r.TaskStatus !== 'Hoàn thành' && !isPmLabel(r.NhanVienPhuTrach))
    .sort((a, b) => Number(a.MaPhong) - Number(b.MaPhong));
  const pmSelectedValid = pmCandidates.filter((r) => pmSelected.has(r.MaPhong));
  const togglePmSelect = (maPhong: string) => {
    setPmSelected((prev) => {
      const next = new Set(prev);
      if (next.has(maPhong)) next.delete(maPhong); else next.add(maPhong);
      return next;
    });
  };
  const pushToPmShift = async () => {
    if (pmGroup.staffs.length === 0 || pmPushing) return;
    const list = pmSelectedValid.length > 0 ? pmSelectedValid : pmCandidates;
    if (list.length === 0) return;
    setPmPushing(true);
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const changes = list.map((r) => ({
      id: r.MaPhong,
      was: `${pmKind(r)} · ${r.NhanVienPhuTrach ? displayLabel(r.NhanVienPhuTrach) : 'chưa gán'}`,
      // CHỈ đổi người phụ trách sang ca chiều — GIỮ NGUYÊN trạng thái DND/RF + bảng treo trên ghi chú.
      // Khi khách cho dọn, nhân viên ca chiều mở thẻ phòng bấm "BỎ DND" / "LÀM LẠI" như ca sáng.
      fields: {
        NhanVienPhuTrach: pmLabel,
        TrolleyCode: PM_GROUP_ID,
      },
    }));
    setRooms((prev) => prev.map((r) => {
      const c = changes.find((x) => x.id === r.MaPhong);
      return c ? { ...r, ...c.fields } : r;
    }));
    setPmMoves((prev) => {
      const next = { ...prev };
      changes.forEach((c) => { next[c.id] = { info: c.was, time: hhmm }; });
      return next;
    });
    setPmSelected(new Set());
    try {
      await Promise.all(changes.map((c) => Promise.all([
        updateRoomFields(c.id, c.fields),
        logTaskAction(c.id, 'Giám sát', PM_MOVE_ACTION, c.was),
      ])));
    } finally {
      setPmPushing(false);
    }
  };

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
  const updateGroups = async (nextRaw: Group[]) => {
    // Luôn giữ thẻ PM Shift khi lưu (các thao tác của nhóm ca sáng không được làm mất ca chiều)
    const next = nextRaw.some((g) => g.id === PM_GROUP_ID) || pmGroup.staffs.length === 0 ? nextRaw : [...nextRaw, pmGroup];
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
    const group = groupsWithPm.find((g) => g.id === groupId);
    if (!group || group.staffs.includes(staff)) { setAddStaffOpenFor(null); return; }
    const oldLabel = groupCurrentLabel(group);
    const updatedGroup = { ...group, staffs: [...group.staffs, staff] };
    const newLabel = groupCurrentLabel(updatedGroup);
    updateGroups(groupsWithPm.map((g) => (g.id === groupId ? updatedGroup : g)));
    setAddStaffOpenFor(null);
    migrateAssignedRooms(oldLabel, newLabel);
  };

  const removeStaffFromGroup = (groupId: string, staff: string) => {
    const group = groupsWithPm.find((g) => g.id === groupId);
    if (!group) return;
    const oldLabel = groupCurrentLabel(group);
    const updatedGroup = { ...group, staffs: group.staffs.filter((s) => s !== staff) };
    const newLabel = groupCurrentLabel(updatedGroup);
    updateGroups(groupsWithPm.map((g) => (g.id === groupId ? updatedGroup : g)));
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
    // Ký hiệu FO:
    //  - Arrival (phòng trống có khách đến): còn dơ -> "VD/ARR" (đỏ đậm); đã sạch -> "ARR" (xanh dương)
    //  - Vacant (phòng trống, không có khách đến): còn dơ -> "VD" (đỏ đậm); Phòng sạch -> "VC" (vàng);
    //    Đã kiểm tra -> "VCI" (xanh lá) — cùng màu trạng thái ở Sơ đồ phòng
    //  - DO/Arr, DO, OD giữ nguyên
    const fo = room.FoStatus === 'Arrival'
      ? room.HkStatus === 'Phòng dơ'
        ? { text: 'VD/ARR', cls: DARK_RED_BADGE }
        : FO_BADGE.Arrival
      : room.FoStatus === 'Vacant' && room.HkStatus === 'Đã kiểm tra'
      ? { text: 'VCI', cls: VCI_BADGE }
      : room.FoStatus === 'Vacant' && room.HkStatus === 'Phòng sạch'
      ? { text: 'VC', cls: VC_BADGE }
      : FO_BADGE[room.FoStatus];
    return (
    <div
      onClick={selectable ? onToggleSelect : undefined}
      className={`group relative flex items-center bg-white border shadow-sm transition-all ${
        selectable
          // Danh sách phòng chưa chọn: dạng VIÊN KẸO bo tròn, nhỏ gọn, rộng theo nội dung
          ? 'cursor-pointer justify-between gap-1.5 rounded-full pl-3 pr-1 py-[3px] text-[11.5px]'
          : 'justify-between gap-2 rounded-lg pl-2.5 pr-2 py-2 text-[12px]'
      } ${selected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'border-slate-200 hover:border-slate-300'}`}
    >
      {/* Nút xoá — góc trên-phải thẻ, tinh tế (chỉ hiện rõ khi hover), không đè lên tên phòng/badge */}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          title="Bỏ phân công"
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-400 shadow-sm flex items-center justify-center text-[9px] font-bold leading-none opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:text-red-600 hover:border-red-300 transition-opacity z-10"
        >
          ✕
        </button>
      )}

      {/* Trái: chấm status (DND/RF = biển cấm tròn) + số phòng + icon EB/BBC/HON (CHỈ 3 mã này, ẩn mọi ghi chú khác) */}
      <span className={`flex items-center font-semibold min-w-0 ${selectable ? 'gap-1' : 'gap-1.5'}`}>
        <StatusSign note={combinedNote} hkStatus={room.HkStatus} noDot={selectable} />
        <span className="truncate tabular-nums">{room.MaPhong}{selectable ? <span className="text-slate-400 font-medium"> · {room.LoaiPhong}</span> : <> - {room.LoaiPhong}</>}</span>
        <RoomGroupBadge flags={room.Flags} />
        <NoteIcons note={combinedNote} ngayO={room.NgayO} />
      </span>

      {/* Phải: badge trạng thái FO (OD/DO/VD/VC/VCI/ARR/VD-ARR/DO-Arr) — đẩy sát mép phải, căn đều trên mọi thẻ.
          Riêng OD mà HÔM NAY đến lịch thay ga giường (checkLinenChange) -> thêm icon sao vàng nhỏ
          ngay sát chữ OD, để nhân viên biết cần mang ga/gối mới khi vào dọn phòng này. */}
      {fo && (
        <span className={`relative flex items-center justify-center min-w-[26px] text-[8px] leading-[12px] font-bold px-1.5 py-0.5 flex-shrink-0 ml-auto whitespace-nowrap ${selectable ? 'rounded-full' : 'rounded'} ${fo.cls}`}>
          {fo.text}
          {/* OD đến lịch thay ga: chiếc lá NHỎ đính ở góc trên-phải ô (không làm ô to ra),
              để ô OD cao/rộng bằng các ô ký hiệu khác */}
          {room.FoStatus === 'Occupied' && checkLinenChange(room) && (
            <span className="absolute -top-[7px] -right-[7px] w-[13px] h-[13px] rounded-full bg-white border border-emerald-300 shadow-sm flex items-center justify-center" title="Hôm nay thay ga giường">
              <Leaf className="w-[9px] h-[9px] text-emerald-600 fill-emerald-400" />
            </span>
          )}
        </span>
      )}
    </div>
    );
  };

  // Ô "SỐ NHÓM ĐANG CHIA" (giống ezFolio): chọn 1–20 nhóm. Tăng -> thêm nhóm trống; giảm -> CHỈ bỏ nhóm
  // trống (không có phòng / nhân viên / nhiệm vụ phụ) để không bao giờ mất dữ liệu đã phân công.
  const applyGroupCount = (n: number) => {
    let next = [...groups];
    let curNormal = next.filter((g) => g.id !== PM_GROUP_ID).length;
    while (curNormal < n) {
      const nums = next.map((g) => Number(g.id.replace('N', '')) || 0);
      next.push({ id: 'N' + (Math.max(0, ...nums) + 1), staffs: [], extraTasks: [] });
      curNormal++;
    }
    for (let i = next.length - 1; i >= 0 && curNormal > n; i--) {
      const g = next[i];
      if (g.id === PM_GROUP_ID) continue;
      const empty = g.staffs.length === 0 && (g.extraTasks?.length || 0) === 0 && roomsForGroup(rooms, g).length === 0;
      if (empty) { next.splice(i, 1); curNormal--; }
    }
    updateGroups(next);
    setGroupCountOpen(false);
  };
  const unassignedRooms = [...dirtyRooms, ...cleanRooms];
  const assignedCount = rooms.length - unassignedRooms.length;
  // Nút ✕ ẩn (góc trên-phải, chỉ hiện khi rê chuột trên máy tính; mờ sẵn trên điện thoại) — giống thẻ phòng
  const HIDDEN_X = 'absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-400 shadow-sm flex items-center justify-center opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:text-red-600 hover:border-red-300 transition-opacity';

  return (
    <div className={selectedIds.size > 0 ? 'pb-36 md:pb-24' : ''}>
      {/* ===== Tiêu đề + nút thao tác ===== */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h1 className="text-[19px] font-extrabold uppercase tracking-tight text-[#1f6fb8]">Phân công dọn phòng</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrintAll}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1f6fb8] rounded-md px-3 py-2"
          >
            <Printer className="w-3.5 h-3.5" /> IN TỔNG HỢP
          </button>
          {/* LÀM MỚI — chỉ tải lại dữ liệu mới nhất, KHÔNG xoá gì cả, bấm thoải mái không lo mất phân công */}
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border border-slate-300 bg-white rounded-md px-3 py-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> LÀM MỚI
          </button>
          {/* XÓA DỮ LIỆU — thao tác phá huỷ, tách riêng khỏi Làm mới, luôn có xác nhận trước khi xoá */}
          <button
            onClick={clearAllAssignments}
            className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 bg-white rounded-md px-3 py-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> XÓA DỮ LIỆU
          </button>
        </div>
      </div>

      {/* ===== Số nhóm + tổng hợp trạng thái + tổng số phòng ===== */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        <button
          type="button"
          onClick={() => { setGroupCountPick(normalGroups.length); setGroupCountOpen(true); }}
          className="flex items-center gap-1.5 rounded-md bg-sky-100 text-sky-800 px-3 py-1.5 text-[12px] font-extrabold uppercase"
        >
          Số nhóm đang chia <span className="text-blue-800 tabular-nums">{normalGroups.length}</span> <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {/* Thanh tổng hợp trạng thái phòng — 4 chỉ số OD / VD-DO / OOO / VC (giữ nguyên cách tính) */}
        <div className="flex items-center gap-3 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-semibold leading-none">
          <span className="flex items-center gap-1 whitespace-nowrap text-red-600"><User className="w-3 h-3" />{statOD} OD</span>
          <span className="flex items-center gap-1 whitespace-nowrap text-orange-500"><AlertCircle className="w-3 h-3" />{statVD_DO} VD/DO</span>
          <span className="flex items-center gap-1 whitespace-nowrap text-slate-500"><Wrench className="w-3 h-3" />{statOOO} OOO</span>
          <span className="flex items-center gap-1 whitespace-nowrap text-emerald-600"><CheckCircle2 className="w-3 h-3" />{statVC} VC</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
          <span className="rounded-md bg-sky-100 text-sky-800 px-3 py-1.5 text-[12px] font-extrabold uppercase whitespace-nowrap">
            Tổng số phòng <span className="text-blue-800 tabular-nums ml-0.5">{rooms.length}</span>
          </span>
          <span className="rounded-md bg-emerald-50 text-emerald-800 px-3 py-1.5 text-[12px] font-extrabold uppercase whitespace-nowrap">
            Số phòng đã phân công <span className="tabular-nums ml-0.5">{assignedCount}</span>
          </span>
        </div>
      </div>

      {/* ===== DANH SÁCH PHÒNG CHƯA CHỌN (kho chờ) — TÁCH 2 Ô như bảng cũ:
          ô 1 = phòng DƠ chưa dọn; ô 2 = phòng SẠCH + VCI (đã kiểm tra) ===== */}
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[13px] font-extrabold uppercase text-[#1f6fb8]">Danh sách phòng chưa chọn</h2>
        {unassignedRooms.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(unassignedRooms.map((r) => r.MaPhong)))}
            className="text-[12px] font-bold text-blue-700 whitespace-nowrap flex-shrink-0"
          >
            Chọn tất cả
          </button>
        )}
      </div>
      {[
        { key: 'dirty', title: 'Phòng cần dọn (Dirty)', list: dirtyRooms, head: 'text-red-600', box: 'border-red-200 bg-red-50/30', empty: 'Không còn phòng dơ chưa phân công' },
        { key: 'clean', title: 'Phòng đã sạch · VCI', list: cleanRooms, head: 'text-emerald-700', box: 'border-emerald-200 bg-emerald-50/30', empty: 'Không có phòng sạch chưa phân công' },
      ].map((sec) => (
        <div key={sec.key} className={`rounded-lg border p-2.5 mb-3 ${sec.box}`}>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className={`text-[12.5px] font-extrabold ${sec.head}`}>
              {sec.title} <span className="text-slate-400 font-semibold text-[11.5px] ml-1">{sec.list.length} phòng</span>
            </span>
            {sec.list.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds((prev) => new Set([...Array.from(prev), ...sec.list.map((r) => r.MaPhong)]))}
                className="text-[11.5px] font-bold text-blue-700 whitespace-nowrap"
              >
                Chọn cả ô
              </button>
            )}
          </div>
          {sec.list.length === 0 ? (
            <div className="text-center text-[12px] text-slate-400 py-3">{sec.empty}</div>
          ) : (
            // Viên kẹo CÙNG ĐỘ RỘNG, xếp thẳng hàng thẳng cột (nhãn OD/ARR luôn sát mép phải) -> gọn, dễ dò
            <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]">
              {sec.list.map((room) => (
                <RoomChip key={room.MaPhong} room={room} selectable selected={selectedIds.has(room.MaPhong)} onToggleSelect={() => toggleSelect(room.MaPhong)} />
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="mb-1" />

      {/* ===== CÁC NHÓM — mỗi nhóm 1 cột như ezFolio ===== */}
      <div
        // 4 xe trolley -> 4 cột nhóm vừa 1 hàng trên laptop (nhóm thứ 5 trở đi xuống hàng dưới)
        className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--ncols),minmax(0,1fr))]"
        style={{ ['--ncols' as any]: Math.min(Math.max(normalGroups.length, 1), 4) }}
      >
        {normalGroups.map((g) => {
          const myRooms = roomsForGroup(rooms, g);
          // Mỗi nhiệm vụ phụ được tính như 01 phòng
          const weighted = calculateWeightedCount(myRooms.map((r) => r.MaPhong)) + (g.extraTasks?.length || 0);
          return (
            <div key={g.id} className={`group/col rounded-lg bg-white border flex flex-col ${selectedIds.size > 0 ? 'border-blue-300' : 'border-slate-200'}`}>
              <div
                onClick={selectedIds.size > 0 ? () => assignSelectedTo(g) : undefined}
                className={`px-3 pt-2.5 pb-2 border-b border-slate-100 ${selectedIds.size > 0 ? 'cursor-pointer bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  {/* Số phòng (điểm khối lượng) đỏ nổi bật */}
                  <span className="text-red-600 font-extrabold text-[15px] tabular-nums">{weighted}</span>
                  <span className="text-[12.5px] text-[#1f6fb8] font-semibold">phòng</span>
                  <span className="text-[10.5px] font-bold text-slate-400 ml-1">{g.id}</span>
                  <div className="ml-auto flex items-center gap-2 text-slate-500">
                    <button type="button" title="Thêm nhiệm vụ khác" onClick={(e) => { e.stopPropagation(); openTaskModal(g.id); }} className="hover:text-blue-700">
                      <Plus className="w-4 h-4" />
                    </button>
                    {/* Xe đẩy của nhóm (N1 -> xe 01...) — thay cho nút in */}
                    <TrolleyBadge code={g.id} />
                    <button
                      type="button"
                      title="Xoá nhóm"
                      onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}
                      className="hover:text-red-600 opacity-60 md:opacity-0 md:group-hover/col:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {/* Tên nhân viên của nhóm + thêm nhân viên */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                  {g.staffs.map((st) => (
                    <span key={st} className="group relative inline-flex items-center rounded bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5">
                      {st}
                      <button type="button" onClick={() => removeStaffFromGroup(g.id, st)} className={`${HIDDEN_X} !w-3.5 !h-3.5`} aria-label={`Bỏ ${st}`}>
                        <X className="w-2 h-2" />
                      </button>
                    </span>
                  ))}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAddStaffOpenFor(addStaffOpenFor === g.id ? null : g.id)}
                      className="flex items-center gap-0.5 rounded border border-dashed border-slate-300 text-slate-500 text-[11px] font-semibold px-2 py-0.5"
                    >
                      + Thêm NV <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                    {addStaffOpenFor === g.id && (
                      <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-32 max-h-48 overflow-y-auto">
                        {staffList.filter((st) => !g.staffs.includes(st)).map((st) => (
                          <div key={st} onClick={() => addStaffToGroup(g.id, st)} className="px-3 py-1.5 text-xs hover:bg-slate-50 cursor-pointer">{st}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto px-2 pt-3 pb-2 flex flex-col gap-1.5 min-h-[70px]">
                {/* Đang chọn phòng -> nút gán nhanh ngay đầu cột */}
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => assignSelectedTo(g)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/60 py-2 text-[12px] font-bold text-blue-700 hover:bg-blue-50 active:scale-[0.98] transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Gán {selectedIds.size} phòng vào {g.id}
                  </button>
                )}
                {myRooms.map((room) => (
                  <RoomChip key={room.MaPhong} room={room} removable onRemove={() => unassignRoom(room.MaPhong)} />
                ))}

                {/* Phòng của nhóm này đã đẩy sang ca chiều — vẫn hiện mờ để giám sát theo dõi */}
                {rooms
                  .filter((r) => isPmLabel(r.NhanVienPhuTrach) && pmMoves[r.MaPhong]?.info.split(' · ')[1] === displayLabel(groupCurrentLabel(g)))
                  .map((r) => (
                    <div key={'pm-' + r.MaPhong} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-indigo-300 bg-indigo-50/60 px-2.5 py-1.5 text-[12px]">
                      <span className="font-bold text-slate-400 line-through tabular-nums">{r.MaPhong} - {r.LoaiPhong}</span>
                      <span className="text-[10px] font-extrabold text-indigo-600 whitespace-nowrap">→ PM · {pmMoves[r.MaPhong].info.split(' · ')[0]}</span>
                    </div>
                  ))}

                {g.extraTasks.map((task, idx2) => (
                  <div key={idx2} className="group relative bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-2 text-[11.5px] text-yellow-800">
                    📋 {task}
                    <button type="button" onClick={() => removeTask(g.id, idx2)} className={HIDDEN_X} aria-label="Xoá nhiệm vụ">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}

                {myRooms.length === 0 && g.extraTasks.length === 0 && selectedIds.size === 0 && (
                  <div className="text-[12px] text-slate-400 text-center py-3">Chưa có phòng</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Hộp chọn SỐ NHÓM (1–20) ===== */}
      {groupCountOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setGroupCountOpen(false)}>
          <div className="w-full max-w-[520px] rounded-lg bg-white shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold uppercase text-[#1f6fb8]">Số nhóm</h3>
              <button type="button" onClick={() => setGroupCountOpen(false)} className="text-slate-400" aria-label="Đóng"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGroupCountPick(n)}
                  className={`h-10 rounded border text-[14px] tabular-nums ${groupCountPick === n ? 'border-blue-600 text-blue-700 font-bold shadow' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-slate-500 mt-3">
              Tăng số nhóm sẽ thêm nhóm trống mới. Giảm số nhóm chỉ bỏ các nhóm trống (chưa có phòng, nhân viên, nhiệm vụ) — nhóm đang có dữ liệu được giữ lại.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => applyGroupCount(groupCountPick)} className="px-4 py-1.5 rounded-md text-white text-[12.5px] font-bold bg-[#1f6fb8]">Đồng ý</button>
              <button type="button" onClick={() => setGroupCountOpen(false)} className="px-4 py-1.5 rounded-md bg-slate-100 text-[12.5px] font-bold">Huỷ</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= THẺ PM SHIFT — nhiệm vụ cố định ca chiều ================= */}
      <div className="mt-5 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-3.5 sm:p-4 shadow-[0_12px_30px_-20px_rgba(79,70,229,.6)] print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
              <Moon className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-indigo-900 tracking-tight">PM Shift</div>
              <div className="text-[11px] text-indigo-700/70">Nhiệm vụ cố định ca chiều</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap sm:ml-2">
            {pmGroup.staffs.length === 0 && <span className="text-[11px] text-indigo-400 italic">Chưa chọn nhân viên ca chiều</span>}
            {pmGroup.staffs.map((st) => (
              <span key={st} className="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white pl-2.5 pr-1 py-1 text-[11px] font-bold">
                {st}
                <button type="button" onClick={() => removeStaffFromGroup(PM_GROUP_ID, st)} className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center" aria-label={`Bỏ ${st}`}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative sm:ml-auto">
            <button
              type="button"
              onClick={() => setAddStaffOpenFor(addStaffOpenFor === PM_GROUP_ID ? null : PM_GROUP_ID)}
              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-white text-xs font-bold text-indigo-700 px-3 py-1.5"
            >
              + Chọn nhân viên <ChevronDown className="w-3 h-3" />
            </button>
            {addStaffOpenFor === PM_GROUP_ID && (
              <div className="absolute z-30 top-full mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-36 max-h-56 overflow-y-auto">
                {staffList.filter((st) => !pmGroup.staffs.includes(st)).map((st) => (
                  <div key={st} onClick={() => addStaffToGroup(PM_GROUP_ID, st)} className="px-3 py-1.5 text-xs hover:bg-indigo-50 cursor-pointer">{st}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3.5 rounded-xl bg-white border border-indigo-100 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[12px] font-bold text-slate-600">
              Phòng DND / RF còn lại của ca sáng: <span className="text-indigo-700">{pmCandidates.length}</span>
            </div>
            <button
              type="button"
              onClick={pushToPmShift}
              disabled={pmCandidates.length === 0 || pmGroup.staffs.length === 0 || pmPushing}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-500 shadow-[0_6px_14px_-6px_rgba(79,70,229,.8)] active:scale-[.98] disabled:opacity-40 disabled:shadow-none"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {pmGroup.staffs.length === 0
                ? 'Chọn nhân viên ca chiều trước'
                : pmPushing
                ? 'Đang chuyển...'
                : pmSelectedValid.length > 0
                ? `Đẩy ${pmSelectedValid.length} phòng đã chọn`
                : `Đẩy tất cả ${pmCandidates.length} phòng sang PM Shift`}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {pmCandidates.length === 0 ? (
              <span className="text-xs text-emerald-600 font-bold">✓ Không còn phòng DND/RF nào cần chuyển</span>
            ) : (
              pmCandidates.map((r) => {
                const on = pmSelected.has(r.MaPhong);
                const isDnd = pmKind(r) === 'DND';
                return (
                  <button
                    key={r.MaPhong}
                    type="button"
                    onClick={() => togglePmSelect(r.MaPhong)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-xs font-extrabold tabular-nums transition ${on ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                      {on && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    {r.MaPhong}
                    <span className={`text-[9px] text-white rounded px-1 ${isDnd ? 'bg-red-600' : 'bg-purple-600'}`}>{isDnd ? 'DND' : 'RF'}</span>
                    {r.NhanVienPhuTrach && <span className="text-[10px] font-semibold text-slate-400">{displayLabel(r.NhanVienPhuTrach)}</span>}
                  </button>
                );
              })
            )}
          </div>
          {pmCandidates.length > 0 && (
            <div className="text-[11px] text-slate-400 mt-2">Bấm chọn từng phòng, hoặc không chọn để đẩy tất cả. Phòng khách đã gỡ DND/RF trong ca sáng sẽ tự biến khỏi danh sách.</div>
          )}
        </div>

        <div className="mt-3">
          <div className="text-[11px] font-extrabold tracking-[0.1em] text-indigo-800/70 uppercase mb-1.5">
            Đã giao cho ca chiều ({pmRooms.length})
          </div>
          {pmRooms.length === 0 ? (
            <span className="text-[11px] text-slate-400">Chưa có phòng nào.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pmRooms.map((room) => {
                const mv = pmMoves[room.MaPhong];
                const state = room.TaskStatus === 'Hoàn thành'
                  ? { t: `Xong ${formatTimeOnly(room.EndTime)}`, c: 'bg-emerald-100 text-emerald-700' }
                  : room.TaskStatus === 'Đang dọn'
                  ? { t: `Đang dọn ${formatTimeOnly(room.StartTime)}`, c: 'bg-blue-100 text-blue-700' }
                  : pmKind(room) === 'DND'
                  ? { t: 'Còn DND', c: 'bg-red-100 text-red-700' }
                  : pmKind(room) === 'RF'
                  ? { t: 'Còn RF', c: 'bg-purple-100 text-purple-700' }
                  : { t: 'Chờ làm', c: 'bg-indigo-100 text-indigo-700' };
                return (
                  <div key={room.MaPhong} className="w-[170px]">
                    <RoomChip room={room} removable onRemove={() => unassignRoom(room.MaPhong)} />
                    <div className="flex items-center justify-between gap-1 mt-1 px-0.5">
                      <span className="text-[9.5px] font-semibold text-slate-400 truncate" title={mv ? `Chuyển lúc ${mv.time}` : ''}>{mv ? `trước: ${mv.info}` : ''}</span>
                      <span className={`text-[9.5px] font-bold rounded px-1.5 py-[1px] whitespace-nowrap ${state.c}`}>{state.t}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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

      {/* Thanh gán nhanh — hiện khi đang chọn phòng: bấm vào nhóm để gán cả loạt phòng đã chọn */}
      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 z-40 bottom-[92px] md:bottom-4 px-3 md:pl-[calc(16rem+1.5rem)] md:pr-6 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl bg-slate-900/95 text-white shadow-[0_12px_30px_rgba(15,23,42,0.45)] border border-slate-700 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12.5px] font-bold">
                Đã chọn <span className="text-sky-300">{selectedIds.size}</span> phòng — bấm nhóm để gán
              </span>
              <button onClick={() => setSelectedIds(new Set())} className="text-[11.5px] font-semibold text-slate-300 hover:text-white underline">
                Bỏ chọn
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {normalGroups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => assignSelectedTo(g)}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white text-slate-800 px-3 py-2 text-[12.5px] font-bold hover:bg-sky-50 active:scale-95 transition"
                >
                  <span className="text-blue-700">{g.id}</span>
                  {g.staffs.length > 0 && <span className="text-slate-500 font-semibold max-w-[110px] truncate">{g.staffs.join('+')}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
