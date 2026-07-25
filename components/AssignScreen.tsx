'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, Printer, ChevronDown, Users } from 'lucide-react';
import type { Room, Group } from '@/lib/types';
import { MASTER_STAFF_LIST } from '@/lib/types';
import { calculateWeightedCount, groupLabel, roomsForGroup } from '@/lib/assignHelpers';
import { NoteIcons, hasDndOrRf } from '@/lib/roomStyles';
import { updateRoomField } from '@/lib/api';

const HK_DOT: Record<string, string> = {
  'Phòng dơ': 'bg-red-500',
  'Phòng đang dọn': 'bg-blue-500',
  'Phòng sạch': 'bg-yellow-400',
  'Đã kiểm tra': 'bg-green-500',
  'Phòng sửa chữa (OOO)': 'bg-slate-400',
};

/* Mục 2 — badge viết tắt theo FO Status */
const FO_BADGE: Record<string, { text: string; cls: string }> = {
  Occupied: { text: 'OD', cls: 'bg-red-50 text-red-600 border border-red-300' },
  'Due out': { text: 'DO', cls: 'bg-orange-50 text-orange-600 border border-orange-300' },
  Vacant: { text: 'VD', cls: 'bg-slate-100 text-slate-500 border border-slate-300' },
  'Due out/ARR': { text: 'DO/Arr', cls: 'bg-purple-50 text-purple-600 border border-purple-300' },
  Arrival: { text: 'ARR', cls: 'bg-sky-50 text-sky-600 border border-sky-300' },
};

/* Mục 4 — tông màu pastel riêng cho từng cột nhân viên, xoay vòng theo index */
const COLUMN_THEMES = [
  { bg: 'bg-blue-50/70', border: 'border-blue-200', header: 'bg-blue-100/80' },
  { bg: 'bg-emerald-50/70', border: 'border-emerald-200', header: 'bg-emerald-100/80' },
  { bg: 'bg-amber-50/70', border: 'border-amber-200', header: 'bg-amber-100/80' },
  { bg: 'bg-purple-50/70', border: 'border-purple-200', header: 'bg-purple-100/80' },
];

const DEFAULT_GROUPS: Group[] = [
  { id: 'N1', staffs: ['Hải'], extraTasks: [] },
  { id: 'N2', staffs: ['Tâm', 'Nghị'], extraTasks: [] },
  { id: 'N3', staffs: ['Tiến'], extraTasks: [] },
  { id: 'N4', staffs: ['Đầu'], extraTasks: [] },
  { id: 'N5', staffs: ['Nhân'], extraTasks: [] },
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
}

export default function AssignScreen({ rooms, setRooms }: AssignScreenProps) {
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS);
  const [addStaffOpenFor, setAddStaffOpenFor] = useState<string | null>(null);
  const [taskModalGroupId, setTaskModalGroupId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');
  // Mục 1 — danh sách phòng đang được chọn (multi-select) trong kho chờ
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem('hkpro_groups');
    if (saved) {
      try { setGroups(JSON.parse(saved)); } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('hkpro_groups', JSON.stringify(groups));
  }, [groups]);

  // Kho phòng chờ CHỈ hiển thị phòng chưa được gán cho nhân viên nào
  // Fix: phòng chỉ tính là "đã gán" khi nhãn của nó khớp với 1 nhóm ĐANG TỒN TẠI.
  // Nếu nhóm bị xoá hoặc đổi thành phần (khiến nhãn cũ không còn khớp nhóm nào),
  // phòng đó tự động coi là chưa gán và quay lại kho chờ — không bị "biến mất".
  const activeGroupLabels = new Set(groups.map((g) => g.staffs.join('+')).filter(Boolean));
  const isUnassigned = (r: Room) => !r.NhanVienPhuTrach || !activeGroupLabels.has(r.NhanVienPhuTrach);
  const dirtyRooms = rooms.filter((r) => r.HkStatus === 'Phòng dơ' && isUnassigned(r));
  const cleanRooms = rooms.filter((r) => r.HkStatus !== 'Phòng dơ' && isUnassigned(r));

  const toggleSelect = (maPhong: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(maPhong)) next.delete(maPhong);
      else next.add(maPhong);
      return next;
    });
  };

  const assignRooms = async (maPhongList: string[], group: Group) => {
    const label = group.staffs.join('+');
    setRooms((prev) => prev.map((r) => (maPhongList.includes(r.MaPhong) ? { ...r, NhanVienPhuTrach: label } : r)));
    await Promise.all(maPhongList.map((id) => updateRoomField(id, 'NhanVienPhuTrach', label)));
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

  const addGroup = () => {
    const nums = groups.map((g) => Number(g.id.replace('N', '')) || 0);
    const nextId = 'N' + (Math.max(0, ...nums) + 1);
    setGroups((prev) => [...prev, { id: nextId, staffs: [], extraTasks: [] }]);
  };

  const removeGroup = (id: string) => setGroups((prev) => prev.filter((g) => g.id !== id));

  const addStaffToGroup = (groupId: string, staff: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId && !g.staffs.includes(staff) ? { ...g, staffs: [...g.staffs, staff] } : g)));
    setAddStaffOpenFor(null);
  };

  const removeStaffFromGroup = (groupId: string, staff: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, staffs: g.staffs.filter((s) => s !== staff) } : g)));
  };

  const openTaskModal = (groupId: string) => { setTaskModalGroupId(groupId); setTaskDraft(''); };
  const submitTask = () => {
    if (!taskModalGroupId || !taskDraft.trim()) return;
    setGroups((prev) => prev.map((g) => (g.id === taskModalGroupId ? { ...g, extraTasks: [...g.extraTasks, taskDraft.trim()] } : g)));
    setTaskModalGroupId(null);
  };
  const removeTask = (groupId: string, idx: number) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, extraTasks: g.extraTasks.filter((_, i) => i !== idx) } : g)));
  };

  const RoomChip = ({
    room, removable, onRemove, selectable, selected, onToggleSelect,
  }: {
    room: Room; removable?: boolean; onRemove?: () => void;
    selectable?: boolean; selected?: boolean; onToggleSelect?: () => void;
  }) => (
    <div
      onClick={selectable ? onToggleSelect : undefined}
      className={`flex items-center justify-between bg-white border rounded-lg px-2.5 py-2 text-[12px] shadow-sm transition-all ${
        selectable ? 'cursor-pointer' : ''
      } ${selected ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'border-slate-200 hover:border-slate-300'}`}
    >
      {/* Mục 2 — trái: chấm status + badge DND/RF + số phòng */}
      <span className="flex items-center gap-1.5 font-semibold min-w-0">
        <i className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${HK_DOT[room.HkStatus] || 'bg-slate-300'}`} />
        {getLeftBadge(room.GhiChu)}
        <span className="truncate">{room.MaPhong} - {room.LoaiPhong}</span>
        {FO_BADGE[room.FoStatus] && (
          <span className={`text-[8px] font-bold px-1 rounded flex-shrink-0 ${FO_BADGE[room.FoStatus].cls}`}>
            {FO_BADGE[room.FoStatus].text}
          </span>
        )}
      </span>

      {/* Mục 3 — phải: icon EB/BBC/HON + nút xoá */}
      <span className="flex items-center gap-1 flex-shrink-0">
        <NoteIcons note={room.GhiChu} />
        {removable && (
          <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="text-slate-400 hover:text-red-500 font-bold px-1">✕</button>
        )}
      </span>
    </div>
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <h1 className="text-[19px] font-bold mb-4">Phân công dọn phòng</h1>

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
                  {MASTER_STAFF_LIST.filter((s) => !g.staffs.includes(s)).map((s) => (
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
                  <span className="font-bold text-sm truncate">{groupLabel(g) || '—'}</span>
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
