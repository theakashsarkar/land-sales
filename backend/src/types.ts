export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "USER";
}

export const ROLES = ["SUPER_ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const PAYMENT_METHODS = ["CASH", "BANK", "CHEQUE", "ONLINE", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
