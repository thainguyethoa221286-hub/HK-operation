import type { Room, Group } from './types';

/** Mục 4 — tính tổng số phòng có cộng thêm tải trọng cho phòng đặc biệt */
export function calculateWeightedCount(roomIds: string[]): number {
  let count = roomIds.length;
  roomIds.forEach((id) => {
    const s = String(id);
    if (s.includes('777')) count += 2;
    if (s.includes('888')) count += 4;
    if (s.includes('999')) count += 1;
  });
  return count;
}

export function groupLabel(group: Group): string {
  return group.staffs.join('+').toUpperCase();
}

/** Phòng đang được giao cho nhóm này (dựa trên NhanVienPhuTrach khớp đúng nhãn nhóm) */
export function roomsForGroup(rooms: Room[], group: Group): Room[] {
  const label = group.staffs.join('+');
  if (!label) return [];
  return rooms.filter((r) => r.NhanVienPhuTrach === label);
}
