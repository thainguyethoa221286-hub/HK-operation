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
  // Thẻ PM Shift (ca chiều) mang tiền tố "PM:" — VD "PM:Hoà" — để KHÔNG trùng nhãn với nhóm ca sáng
  // khi cùng 1 nhân viên làm cả 2 ca (ca sáng "Hoà", ca chiều "PM:Hoà").
  if (group.id === PM_GROUP_ID) return group.staffs.length > 0 ? PM_PREFIX + group.staffs.join('+') : PM_GROUP_ID;
  return group.staffs.length > 0 ? group.staffs.join('+') : group.id;
}

/* =========================================================
   PM SHIFT — nhiệm vụ CỐ ĐỊNH ca chiều (nhóm đặc biệt id "PM" lưu chung bảng Nhóm phân công).
   Giám sát ca sáng đẩy các phòng DND / RF còn lại sang đây để ca chiều mở thẻ phòng làm tiếp.
   ========================================================= */
export const PM_GROUP_ID = 'PM';
export const PM_PREFIX = 'PM:';
export const PM_MOVE_ACTION = 'Chuyển PM Shift';
export const emptyPmGroup = (): Group => ({ id: PM_GROUP_ID, staffs: [], extraTasks: [] });

/** Tên các nhân viên trong 1 nhãn NhanVienPhuTrach ("Tâm+Nghị", "PM:Hoà" -> ["Hoà"]) */
export function labelNames(label: string): string[] {
  return (label || '').replace(/^PM:/, '').split('+').map((s) => s.trim()).filter(Boolean);
}
/** Nhãn để HIỂN THỊ: "PM:Hoà" -> "PM Shift · Hoà" */
export function displayLabel(label: string): string {
  if (label === PM_GROUP_ID) return 'PM Shift';
  return label.startsWith(PM_PREFIX) ? `PM Shift · ${label.slice(PM_PREFIX.length)}` : label;
}
export const isPmLabel = (label: string) => label === PM_GROUP_ID || (label || '').startsWith(PM_PREFIX);

/** Phòng đang được giao cho nhóm này (dựa trên NhanVienPhuTrach khớp đúng nhãn hiện tại của nhóm) */
export function roomsForGroup(rooms: Room[], group: Group): Room[] {
  const label = groupCurrentLabel(group);
  return rooms.filter((r) => r.NhanVienPhuTrach === label);
}
