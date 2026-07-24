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

export interface Room {
  MaPhong: string;
  Tang: string;
  LoaiPhong: string;
  HkStatus: HkStatus;
  FoStatus: FoStatus;
  NgayO: string;
  NhanVienPhuTrach: string;
  GhiChu: string;
  Flags: string;
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
