import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';

@Injectable()
export class ReposService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRepoDto, creator: any) {
    if (creator.role !== 'manager') {
      throw new ForbiddenException('Only managers can create repos');
    }

    return this.prisma.repos.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        url: dto.url,
        organization_id: dto.organization_id,
      },
    });
  }

  async findAll() {
    return this.prisma.repos.findMany();
  }

  async findOne(id: string) {
    const repo = await this.prisma.repos.findUnique({
      where: { id },
    });
    if (!repo) throw new NotFoundException('Repo not found');
    return repo;
  }

  async update(id: string, dto: UpdateRepoDto, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can edit repos');

    return this.prisma.repos.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can delete repos');

    return this.prisma.repos.delete({ where: { id } });
  }
}
