export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  /** Optional phone number used for password reset and contact */
  phone?: string | null;
  gender?: string | null;
  avatar?: string | null;
  role_id: string | number;
  role: string;
  created_date?: string;
}

