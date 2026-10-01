/**
 * ============================================================
 *  supabaseClient.ts — Kết nối tới Supabase (project RIÊNG của HK Operation,
 *  KHÁC với project đang dùng cho Kho HK/Roster).
 * ============================================================
 *  Project URL + anon key ở đây là loại "public" — được thiết kế để
 *  nhúng thẳng vào code frontend, không phải bí mật cần giấu. Mật khẩu
 *  tài khoản nhân viên (bảng hkpro_accounts) được khoá riêng ở Supabase,
 *  chỉ đọc được qua các hàm RPC (hkpro_login, hkpro_login_by_password...),
 *  không đọc thẳng được qua key này.
 * ============================================================
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ckcncdgllkszjiddntzv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mt7dj9oq8Mrn7FXuHUvGDw_E9Ij4dYH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
