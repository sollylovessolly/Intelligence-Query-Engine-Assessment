export type UserRole = "admin" | "analyst";

export type AuthUser = {
  id: string;
  github_id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
};