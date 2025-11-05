import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.users.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        created_at: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({where: {id} });
    if(!user) throw new NotFoundException('User not found');
    return user;
  }

  async remove(id: string) {
    const user = await this.prisma.users.findUnique({where: {id} });
    if(!user) throw new NotFoundException('User not found');
    return this.prisma.users.delete({ where: {id}});
  }
}
