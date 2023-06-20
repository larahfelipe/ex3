export const envs = {
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  accessTokenStorageKey: 'ex3@token',
  userStorageKey: 'ex3@user'
} as const;
