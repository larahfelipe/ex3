import { api } from '@/lib/axios';

export const getAssets = async () => await api.get('/v1/assets');
