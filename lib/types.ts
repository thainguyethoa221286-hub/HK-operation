export type HkStatus =
  | 'Phòng dơ'
  | 'Phòng đang dọn'
  | 'Phòng sạch'
  | 'Đã kiểm tra'
  | 'Phòng sửa chữa (OOO)';

export type FoStatus =
  | 'Occupied'
  | 'Due out'
  | 'Arrival'
  | 'Due out/ARR'
  | 'Vacant';

/* =========================================================
   MODULE NHIỆM VỤ + RBAC
   ========================================================= */
export type Role = 'Admin' | 'GiamSat' | 'HKStaff';

export interface Account {
  id: string;
  hoTen: string;
  vaiTro: Role;
}

export type TaskStatus = 'Chưa dọn' | 'Đang dọn' | 'Hoàn thành' | 'Refused' | 'DND';
export type SafeStatus = 'Chưa kiểm' | 'Mở' | 'Đóng';

export const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Admin',
  GiamSat: 'Giám sát',
  HKStaff: 'Nhân viên HK',
};

/** 1 dòng lịch sử thao tác của 1 phòng trong ngày — lưu ở tab riêng "LichSuDon",
 *  KHÔNG ghi đè, mỗi lần bấm hành động (Bắt đầu/Hoàn thành/Báo dơ lại/DND/RF/Làm lại) thêm 1 dòng mới. */
export interface HistoryEntry {
  ngay: string;
  maPhong: string;
  nhanVien: string;
  hanhDong: string;
  gio: string;
  chiTiet: string;
}

export interface Room {
  MaPhong: string;
  Tang: string;
  LoaiPhong: string;
  HkStatus: HkStatus;
  FoStatus: FoStatus;
  NgayO: string;
  NhanVienPhuTrach: string;
  GhiChu: string;
  /** Ghi chú thủ công do nhân viên/quản lý tự gõ qua modal — TÁCH RIÊNG khỏi GhiChu (cột AI ghi),
   *  để Đồng bộ AI không bao giờ ghi đè mất ghi chú tay. Cũng là ô "Thêm ghi chú" trong màn Nhiệm vụ. */
  GhiChuNV: string;
  Flags: string;
  /** Thời điểm bấm "Bắt đầu dọn phòng" (HH:mm:ss). Khi TaskStatus="Refused", trường này
   *  được TÁI SỬ DỤNG để lưu thời điểm bấm Refused (vì phòng bị từ chối thì chưa có giờ bắt đầu dọn thật). */
  StartTime: string;
  /** Thời điểm bấm "Hoàn thành dọn phòng" (HH:mm:ss) */
  EndTime: string;
  /** Số phút dọn phòng thực tế = EndTime - StartTime */
  Duration: string;
  /** Trạng thái nhiệm vụ dọn phòng hiện tại của nhân viên được gán */
  TaskStatus: TaskStatus;
  /** Trạng thái kiểm tra két sắt */
  SafeStatus: SafeStatus;
  /** Có thay giường trong lượt dọn này không — 'Có' hoặc rỗng */
  LinenChange: string;
  /** Trạng thái tạm thời — KHÔNG lưu vào Sheet, chỉ tồn tại trong phiên làm việc hiện tại */
  isInspecting: boolean;
}

export const HK_STATUSES: HkStatus[] = [
  'Phòng dơ',
  'Phòng đang dọn',
  'Phòng sạch',
  'Đã kiểm tra',
  'Phòng sửa chữa (OOO)',
];

export const FO_STATUSES: FoStatus[] = [
  'Occupied',
  'Due out',
  'Arrival',
  'Due out/ARR',
  'Vacant',
];

export const FLAGS = [
  { key: 'CayBac', label: 'Rush', icon: '🔔' },
  { key: 'TrangDiem', label: 'MKR', icon: '🖌' },
  { key: 'DaOut', label: 'Đã out', icon: '🛏' },
  { key: 'SuaChua', label: 'Sửa chữa', icon: '🔧' },
] as const;

export interface Group {
  id: string;
  staffs: string[];
  extraTasks: string[];
}

export const MASTER_STAFF_LIST = ['Nhân', 'Tiến', 'Tâm', 'Hải', 'Hồng', 'Nghị', 'Trúc', 'HK', 'Tôi', 'Đầu'];

export const STAFF_LIST = ['Nhân', 'Tiến', 'Nghị', 'Tâm', 'Hài', 'Hồng', 'Trúc', 'HK'];
