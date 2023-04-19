export type User = {
  id: string;
  name: string | null;
  email: string;
  password: string;
  accessToken: string | null;
  createdAt: Date;
  updatedAt: Date;
};
