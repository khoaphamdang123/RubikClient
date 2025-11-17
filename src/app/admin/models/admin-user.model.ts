export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  gender?: string | null;
  avatar?: string | null;
  role_id: string | number;
  role: string;
  created_date?: string;
}




