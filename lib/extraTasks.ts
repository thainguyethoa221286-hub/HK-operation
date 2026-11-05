import type { Group, HistoryEntry } from './types';
import { getTodayHistory, logTaskAction } from './api';

/* =========================================================
   NHIỆM VỤ PHỤ (extraTasks của Nhóm ở màn Phân công)
   - Danh sách nhiệm vụ lấy từ Nhóm (hkpro_assign_groups).
   - Tiến độ (Bắt đầu / Hoàn thành / Làm lại) GHI VÀO LỊCH SỬ DỌN TRONG NGÀY
     (hkpro_lich_su_don) với "mã phòng" dạng  NVP|<mã nhóm>|<nội dung>  — chỉ ghi thêm
     dòng mới, không ghi đè, nên không bao giờ đụng/lẫn với dữ liệu Nhóm của Giám sát.
   - Mỗi ngày lịch sử tự lọc theo ngày hôm nay -> nhiệm vụ tự về "Chưa làm" ngày mới.
   - Mỗi nhiệm vụ phụ được tính như 01 phòng trong tiến độ.
   ========================================================= */

export const EXTRA_PREFIX = 'NVP|';
export const EXTRA_ACT = {
  start: 'NV phụ - Bắt đầu',
  done: 'NV phụ - Hoàn thành',
  redo: 'NV phụ - Làm lại',
} as const;

export type ExtraStatus = 'todo' | 'doing' | 'done';

export interface ExtraTaskItem {
  key: string;
  groupId: string;
  /** Nhãn nhóm (VD "Tâm+Nghị") — dùng để gom theo nhân viên ở màn tổng quan của Giám sát */
  groupLabel: string;
  text: string;
  status: ExtraStatus;
  start: string; // HH:mm:ss
  end: string; // HH:mm:ss
  minutes: string;
  by: string;
}

export const extraKey = (groupId: string, text: string) => `${EXTRA_PREFIX}${groupId}|${text}`;

/** Gộp danh sách nhiệm vụ của các nhóm + lịch sử hôm nay -> trạng thái từng nhiệm vụ */
export function buildExtraTasks(groups: Group[], history: HistoryEntry[]): ExtraTaskItem[] {
  const items: ExtraTaskItem[] = [];
  groups.forEach((g) => {
    const label = g.staffs.length > 0 ? g.staffs.join('+') : g.id;
    (g.extraTasks || []).forEach((text) => {
      const key = extraKey(g.id, text);
      const it: ExtraTaskItem = { key, groupId: g.id, groupLabel: label, text, status: 'todo', start: '', end: '', minutes: '', by: '' };
      history.forEach((h) => {
        if (h.maPhong !== key) return;
        if (h.hanhDong === EXTRA_ACT.start) Object.assign(it, { status: 'doing', start: h.gio, end: '', minutes: '', by: h.nhanVien });
        else if (h.hanhDong === EXTRA_ACT.done) Object.assign(it, { status: 'done', end: h.gio, minutes: h.chiTiet, by: h.nhanVien });
        else if (h.hanhDong === EXTRA_ACT.redo) Object.assign(it, { status: 'todo', start: '', end: '', minutes: '', by: '' });
      });
      items.push(it);
    });
  });
  return items;
}

/** Chỉ lấy các dòng lịch sử của nhiệm vụ phụ trong ngày */
export async function getExtraTaskHistory(): Promise<HistoryEntry[]> {
  const all = await getTodayHistory();
  return all.filter((h) => (h.maPhong || '').startsWith(EXTRA_PREFIX));
}

export async function logExtraTask(key: string, staff: string, action: string, detail = '') {
  await logTaskAction(key, staff, action, detail);
}
