export interface User {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export type LoginResult = { status: "success"; user: User } | { status: "totp_required" };

export interface VerifyTotpLoginResult {
  user: User;
  recoveryCodeWarning?: string;
}
