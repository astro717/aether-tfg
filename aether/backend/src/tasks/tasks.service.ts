
import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';


@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
  ) {}

  async create(dto: CreateTaskDto, creator: any) {
    if (!dto.title || !dto.repo_id) {
      throw new BadRequestException('title and repo_id are required');
    }

    const data: any = {
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'pending',
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      repo_id: dto.repo_id,
      assignee_id: creator.id, // el usuario autenticado
    };
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

  async findOneOwned(id: string, userId: string, userRole?: string) {
    const task = await this.prisma.tasks.findUnique({
      where: { id },
      include: {
        users_tasks_assignee_idTousers: {
          select: { id: true, username: true, email: true },
        },
        repos: {
          select: { id: true, name: true },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    // Managers can view any task, regular users can only view their own
    if (userRole !== 'manager' && task.assignee_id !== userId) {
      throw new ForbiddenException('Not your task');
    }
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
    const where = user.role === 'manager'
      ? {}
      : { assignee_id: user.id };

    return this.prisma.tasks.findMany({
      where,
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        repos: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // Returns only tasks assigned to the user (for sidebar) - regardless of role
  async findMyTasks(userId: string) {
    return this.prisma.tasks.findMany({
      where: { assignee_id: userId },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        repos: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // Find tasks by organization
  async findAllByOrganization(organizationId: string, userId: string) {
    // Verify user belongs to organization
    const userOrg = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: userId,
          organization_id: organizationId,
        },
      },
    });

    if (!userOrg) {
      throw new ForbiddenException('User does not belong to this organization');
    }

    // Get all repos in organization
    const orgRepos = await this.prisma.repos.findMany({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    const repoIds = orgRepos.map((r) => r.id);

    // Get tasks from those repos
    return this.prisma.tasks.findMany({
      where: {
        repo_id: { in: repoIds },
      },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        repos: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  // Get tasks grouped by status for Kanban
  async getTasksByStatus(organizationId: string, userId: string) {
    const allTasks = await this.findAllByOrganization(organizationId, userId);

    const grouped = {
      pending: allTasks.filter((t) => t.status === 'pending'),
      in_progress: allTasks.filter((t) => t.status === 'in_progress'),
      done: allTasks.filter((t) => t.status === 'done'),
    };

    return {
      pending: grouped.pending,
      in_progress: grouped.in_progress,
      done: grouped.done,
      totals: {
        pending: grouped.pending.length,
        in_progress: grouped.in_progress.length,
        done: grouped.done.length,
        all: allTasks.length,
      },
    };
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

  // Comment methods
  async addComment(taskId: string, userId: string, content: string) {
    // Verify task exists and get assignee info
    const task = await this.prisma.tasks.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // Create the comment
    const comment = await this.prisma.task_comments.create({
      data: {
        task_id: taskId,
        user_id: userId,
        content,
      },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // If task has an assignee and commenter is NOT the assignee, send notification
    if (task.assignee_id && task.assignee_id !== userId) {
      await this.messagesService.createCommentNotification(
        userId,
        task.assignee_id,
        content,
        taskId,
        task.title,
      );
    }

    return comment;
  }

  async getComments(taskId: string) {
    // Verify task exists
    const task = await this.prisma.tasks.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task_comments.findMany({
      where: { task_id: taskId },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async deleteComment(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.task_comments.findUnique({
      where: { id: commentId },
    });

    if (!comment) throw new NotFoundException('Comment not found');

    // Only comment author or manager can delete
    if (comment.user_id !== userId && userRole !== 'manager') {
      throw new ForbiddenException('Not authorized to delete this comment');
    }

    return this.prisma.task_comments.delete({ where: { id: commentId } });
  }
}

