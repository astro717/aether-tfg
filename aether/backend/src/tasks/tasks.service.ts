
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Prisma } from '@prisma/client';


@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTaskDto, creator: any) {
    const data: any = {
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'pending',
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
        repo_id: dto.repo_id,
        assignee_id: creator.id, //  el usuario autenticado
      }};
      // si creador es manager -> tarea ya validada
      if (creator.role === 'manager') {
        data.validated_by = creator.id;
      }
      return this.prisma.tasks.create({ data });
  }


  async findAllByUser(userId: string, opts?: { status?: string; q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const where: Prisma.tasksWhereInput = {
      assignee_id: userId,
      ...(opts?.status ? { status: opts.status } : {}),
      ...(opts?.q
        ? {
            OR: [
              { title: { contains: opts.q, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: opts.q, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tasks.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tasks.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOneOwned(id: string, userId: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assignee_id !== userId) throw new ForbiddenException('Not your task');
    return task;
  }

  async updateOwned(id: string, userId: string, dto: UpdateTaskDto) {
    // comprueba propiedad
    await this.findOneOwned(id, userId);

    return this.prisma.tasks.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
        comments: dto.comments,
      },
    });
  }

  async removeOwned(id: string, userId: string) {
    // comprueba propiedad
    await this.findOneOwned(id, userId);
    return this.prisma.tasks.delete({ where: { id } });
  }


  async validateTask(id: string, managerId: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new Error('Task not found');
  
    // Ya validada → no hacer nada
    if (task.validated_by) {
      throw new Error('Task already validated');
    }
  
    // Registrar quién la validó
    return this.prisma.tasks.update({
      where: { id },
      data: {
        validated_by: managerId,
      },
    });
  }
  


  async findAllByRole(user: any) {
    if (user.role === 'manager') {
      return this.prisma.tasks.findMany();
    }
    return this.prisma.tasks.findMany({
      where: { assignee_id: user.id },
    });
  }
  
  async update(id: string, dto: any, user: any) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new Error('Task not found');
  
    // Solo manager o el usuario asignado puede modificar
    if (user.role !== 'manager' && task.assignee_id !== user.id) {
      throw new Error('No permission to modify this task');
    }
  
    return this.prisma.tasks.update({
      where: { id },
      data: dto,
    });
  }
  
  async remove(id: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new Error('Task not found');
  
    return this.prisma.tasks.delete({ where: { id } });
  }
  
  
}

