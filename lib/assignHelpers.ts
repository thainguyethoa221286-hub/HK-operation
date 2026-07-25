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

/** Nhãn THỰC SỰ dùng để lưu vào cột NhanVienPhuTrach trên Sheet:
 *  - Có nhân viên -> tên nhân viên nối bằng "+" (VD "Tâm+Nghị")
 *  - CHƯA có nhân viên -> dùng chính mã nhóm (VD "N6") làm nhãn tạm,
 *    để giám sát có thể kéo phòng vào cột trước, thêm tên nhân viên sau
 *    mà không mất phòng đã kéo. */
export function groupCurrentLabel(group: Group): string {
  return group.staffs.length > 0 ? group.staffs.join('+') : group.id;
}

/** Phòng đang được giao cho nhóm này (dựa trên NhanVienPhuTrach khớp đúng nhãn hiện tại của nhóm) */
export function roomsForGroup(rooms: Room[], group: Group): Room[] {
  const label = groupCurrentLabel(group);
  return rooms.filter((r) => r.NhanVienPhuTrach === label);
}
