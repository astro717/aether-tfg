import type { users as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User extends PrismaUser{}
  }
}
