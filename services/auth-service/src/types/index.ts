export type AuthUser = {
  id: string;
  email: string;
};

export type UserRecord = AuthUser & {
  password_hash: string;
};

export type AuthResponseData = {
  user: AuthUser;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};
