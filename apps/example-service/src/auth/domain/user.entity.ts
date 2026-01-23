export type UserId = string;

export type UserRole = "admin" | "user";

export type User = Readonly<{
  id: UserId;
  email: string;
  name: string;
  roles: UserRole[];
}>;
