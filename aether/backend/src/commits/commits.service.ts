import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommitDto } from './dto/create-commit.dto';
import { UpdateCommitDto } from './dto/update-commit.dto';

@Injectable()
export class CommitsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCommitDto, user: any) {
    return this.prisma.commits.create({
      data: {
        sha: dto.sha,
        repo_id: dto.repo_id,
        author_login: user.username,
        committed_at: dto.committed_at ?? new Date(),
        message: dto.message,
        added_lines: dto.added_lines ?? 0,
        deleted_lines: dto.deleted_lines ?? 0,
      },
    });
  }

  async findAll() {
    return this.prisma.commits.findMany({
      orderBy: { committed_at: 'desc' },
    });
  }

  async findByRepo(repoId: string) {
    return this.prisma.commits.findMany({
      where: { repo_id: repoId },
      orderBy: { committed_at: 'desc' },
    });
  }

  async update(sha: string, dto: UpdateCommitDto, user: any) {
    const commit = await this.prisma.commits.findUnique({ where: { sha } });
    if (!commit) throw new NotFoundException('Commit not found');

    // Author can edit their own commits, managers can edit all
    if (commit.author_login !== user.username && user.role !== 'manager') {
      throw new ForbiddenException('You cannot edit this commit');
    }

    return this.prisma.commits.update({
      where: { sha },
      data: dto,
    });
  }

  async remove(sha: string, user: any) {
    if (user.role !== 'manager') throw new ForbiddenException('Only managers can delete commits');

    return this.prisma.commits.delete({ where: { sha } });
  }
}
