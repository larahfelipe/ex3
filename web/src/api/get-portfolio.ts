import { api } from '@/lib/axios';

export const getPortfolio = async () => await api.get('/v1/portfolio');
