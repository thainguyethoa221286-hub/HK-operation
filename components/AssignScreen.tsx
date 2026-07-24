'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X, Printer, ChevronDown, Users } from 'lucide-react';
import type { Room, Group } from '@/lib/types';
import { MASTER_STAFF_LIST } from '@/lib/types';
import { calculateWeightedCount, groupLabel, roomsForGroup } from '@/lib/assignHelpers';
import { updateRoomField } from '@/lib/api';

const HK_DOT: Record<string, string> = {
  'Phòng dơ': 'bg-red-500',
  'Phòng đang dọn': 'bg-blue-500',
  'Phòng sạch': 'bg-yellow-400',
  'Đã kiểm tra': 'bg-green-500',
  'Phòng sửa chữa (OOO)': 'bg-slate-400',
};

const DEFAULT_GROUPS: Group[] = [
  { id: 'N1', staffs: ['Hải'], extraTasks: [] },
  { id: 'N2', staffs: ['Tâm', 'Nghị'], extraTasks: [] },
  { id: 'N3', staffs: ['Tiến'], extraTasks: [] },
  { id: 'N4', staffs: ['Đầu'], extraTasks: [] },
  { id: 'N5', staffs: ['Nhân'], extraTasks: [] },
];

interface AssignScreenProps {
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
}

export default function AssignScreen({ rooms, setRooms }: AssignScreenProps) {
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS);
  const [addStaffOpenFor, setAddStaffOpenFor] = useState<string | null>(null);
  const [taskModalGroupId, setTaskModalGroupId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('hkpro_groups');
    if (saved) {
      try { setGroups(JSON.parse(saved)); } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('hkpro_groups', JSON.stringify(groups));
  }, [groups]);

  const dirtyRooms = rooms.filter((r) => r.HkStatus === 'Phòng dơ');
  const cleanRooms = rooms.filter((r) => r.HkStatus !== 'Phòng dơ');

  const assignRoom = async (maPhong: string, group: Group) => {
    const label = group.staffs.join('+');
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, NhanVienPhuTrach: label } : r)));
    await updateRoomField(maPhong, 'NhanVienPhuTrach', label);
  };

  const unassignRoom = async (maPhong: string) => {
    setRooms((prev) => prev.map((r) => (r.MaPhong === maPhong ? { ...r, NhanVienPhuTrach: '' } : r)));
    await updateRoomField(maPhong, 'NhanVienPhuTrach', '');
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    if (!destination.droppableId.startsWith('group-')) return;
    const groupId = destination.droppableId.replace('group-', '');
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const maPhong = draggableId.replace(/^pool-/, '').replace(/^assigned-[^-]+-/, '');
    assignRoom(maPhong, group);
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

  const RoomChip = ({ room, removable, onRemove }: { room: Room; removable?: boolean; onRemove?: () => void }) => (
    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[12px]">
      <span className="flex items-center gap-1.5 font-semibold">
        <i className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${HK_DOT[room.HkStatus] || 'bg-slate-300'}`} />
        {room.MaPhong} - {room.LoaiPhong}
      </span>
      {removable && (
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 font-bold px-1">✕</button>
      )}
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
                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="w-[140px]">
                    <RoomChip room={room} />
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
                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="w-[140px]">
                    <RoomChip room={room} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

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

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, minmax(220px, 1fr))` }}>
        {groups.map((g) => {
          const myRooms = roomsForGroup(rooms, g);
          const weighted = calculateWeightedCount(myRooms.map((r) => r.MaPhong));
          return (
            <div key={g.id} className="bg-white border border-slate-200 rounded-xl flex flex-col">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="font-bold text-sm truncate">{groupLabel(g) || '—'}</span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">({weighted} phòng)</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Printer className="w-3.5 h-3.5 text-slate-400 cursor-pointer" onClick={() => window.print()} />
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
                    className={`flex-1 p-2 space-y-1.5 min-h-[80px] transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
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

                    {g.extraTasks.map((task, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-2.5 py-2 text-[11px] text-yellow-800">
                        <span>📋 {task}</span>
                        <X className="w-3 h-3 cursor-pointer flex-shrink-0 mt-0.5" onClick={() => removeTask(g.id, idx)} />
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
