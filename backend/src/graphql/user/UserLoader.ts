import { PrismaClient } from '@/config';

const loadAll = async () => {
  const prismaClient = PrismaClient.getInstance();

  const users = await prismaClient.user.findMany();

  return users;
};

export { loadAll };
