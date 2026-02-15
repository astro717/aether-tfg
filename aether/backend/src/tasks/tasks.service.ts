
import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Prisma } from '@prisma/client';
import { MessagesService } from '../messages/messages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';


import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private configService: ConfigService,
    private organizationsService: OrganizationsService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  /**
   * Get the task link for emails
   */
  private getTaskLink(taskId: string): string {
    return `${this.frontendUrl}/tasks/${taskId}`;
  }

  /**
   * CRON Job: Check for tasks approaching deadline and create notifications.
   * Runs every hour. Respects user-configured reminder hours.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleDeadlineChecks() {
    this.logger.log('Running deadline check cron job...');

    const now = new Date();
    const maxLookAhead = 48; // Max hours to look ahead (2 days)
    const futureLimit = new Date(now.getTime() + maxLookAhead * 60 * 60 * 1000);

    try {
      // Find all incomplete tasks with due dates within the next 48h or overdue
      const upcomingTasks = await this.prisma.tasks.findMany({
        where: {
          due_date: {
            lte: futureLimit,
          },
          status: {
            not: 'done',
          },
          assignee_id: {
            not: null,
          },
          is_archived: false,
        },
        select: {
          id: true,
          title: true,
          due_date: true,
          assignee_id: true,
        },
      });

      if (upcomingTasks.length === 0) {
        this.logger.log('No tasks approaching deadline.');
        return;
      }

      // Get all assignee IDs to fetch their preferences
      const assigneeIds = [...new Set(upcomingTasks.map((t) => t.assignee_id!))];

      // Fetch user preferences
      const users = await this.prisma.users.findMany({
        where: { id: { in: assigneeIds } },
        select: {
          id: true,
          email: true,
          username: true,
          notify_email_enabled: true,
          notify_inapp_enabled: true,
          deadline_reminder_hours: true,
        },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Get recent TASK_DEADLINE notifications to avoid duplicates
      // We track by "taskId:userId:reminderHours" to allow multiple reminders
      const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const recentNotifications = await this.prisma.notifications.findMany({
        where: {
          type: { in: ['TASK_DEADLINE', 'TASK_DEADLINE_24H', 'TASK_DEADLINE_OVERDUE'] },
          created_at: { gte: last48h },
        },
        select: {
          entity_id: true,
          user_id: true,
          type: true,
        },
      });

      // Create a set for quick lookup
      const notifiedSet = new Set(
        recentNotifications.map((n) => `${n.entity_id}:${n.user_id}:${n.type}`)
      );

      let createdCount = 0;
      let emailCount = 0;

      for (const task of upcomingTasks) {
        if (!task.assignee_id || !task.due_date) continue;

        const user = userMap.get(task.assignee_id);
        if (!user) continue;

        const dueDate = new Date(task.due_date);
        const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        const isOverdue = hoursUntilDue < 0;

        // Get user's reminder hours (default to [24] if not set)
        const reminderHours = user.deadline_reminder_hours?.length > 0
          ? user.deadline_reminder_hours
          : [24];

        // Check if we should send a reminder for any of the configured hours
        for (const reminderHour of reminderHours) {
          // Check if we're within the reminder window (±30 min tolerance for hourly cron)
          const shouldRemind = !isOverdue && hoursUntilDue <= reminderHour && hoursUntilDue > reminderHour - 1;

          if (!shouldRemind && !isOverdue) continue;

          const notificationType = isOverdue ? 'TASK_DEADLINE_OVERDUE' : `TASK_DEADLINE_${reminderHour}H`;
          const key = `${task.id}:${task.assignee_id}:${notificationType}`;

          if (notifiedSet.has(key)) {
            continue; // Already notified for this specific reminder
          }

          // Determine notification content
          let title: string;
          let content: string;

          if (isOverdue) {
            title = 'Task Overdue';
            content = `"${task.title}" is overdue!`;
          } else if (reminderHour >= 24) {
            const days = Math.floor(reminderHour / 24);
            title = 'Deadline Approaching';
            content = `"${task.title}" is due in ${days === 1 ? '1 day' : `${days} days`}.`;
          } else {
            title = 'Deadline Approaching';
            content = `"${task.title}" is due in ${reminderHour} hour${reminderHour > 1 ? 's' : ''}.`;
          }

          // Create in-app notification if enabled
          if (user.notify_inapp_enabled !== false) {
            await this.notificationsService.create({
              user_id: task.assignee_id,
              actor_id: undefined,
              type: notificationType as any,
              title,
              content,
              entity_id: task.id,
              entity_type: 'task',
            });
            createdCount++;
          }

          // Send email if enabled
          if (user.notify_email_enabled) {
            this.emailService.sendDeadlineReminderEmail(
              user.email,
              user.username,
              task.title,
              dueDate,
              isOverdue,
              this.getTaskLink(task.id),
            ).then(() => emailCount++)
              .catch((err) => this.logger.error('Failed to send deadline email:', err));
          }

          // Add to notified set to avoid duplicate in this run
          notifiedSet.add(key);

          // Only send one reminder per task per run (prioritize overdue or closest reminder)
          if (isOverdue) break;
        }
      }

      this.logger.log(`Deadline check complete. Created ${createdCount} notifications, queued ${emailCount} emails.`);
    } catch (error) {
      this.logger.error('Error in deadline check cron job:', error);
    }
  }

  async create(dto: CreateTaskDto, creator: any) {
    if (!dto.title) {
      throw new BadRequestException('title is required');
    }

    if (!dto.organization_id) {
      throw new BadRequestException('organization_id is required');
    }

    if (!dto.assignee_id) {
      throw new BadRequestException('assignee_id is required');
    }

    // Check organization access
    const { role } = await this.organizationsService.checkAccess(creator, dto.organization_id, ['admin', 'manager', 'member']);
    const isManager = role === 'admin' || role === 'manager' || role === 'global_manager';

    // Non-managers can only assign tasks to themselves
    if (!isManager && dto.assignee_id !== creator.id) {
      throw new ForbiddenException('You can only assign tasks to yourself');
    }

    // Determine initial status based on role:
    // - Managers: task starts as 'todo' (validated automatically)
    // - Members: task starts as 'pending_validation' (needs manager approval)
    const initialStatus = isManager ? (dto.status ?? 'todo') : 'pending_validation';

    const data: any = {
      title: dto.title,
      description: dto.description,
      status: initialStatus,
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      repo_id: dto.repo_id || null,
      organization_id: dto.organization_id,
      assignee_id: dto.assignee_id,
    };

    // If creator is manager -> task is already validated
    if (isManager) {
      data.validated_by = creator.id;
    }

    const task = await this.prisma.tasks.create({ data });

    // Create notification if task is assigned to someone other than creator
    if (dto.assignee_id && dto.assignee_id !== creator.id) {
      await this.notificationsService.create({
        user_id: dto.assignee_id,
        actor_id: creator.id,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        content: dto.title,
        entity_id: task.id,
        entity_type: 'task',
      });

      // Send email notification if user has it enabled
      const assignee = await this.prisma.users.findUnique({
        where: { id: dto.assignee_id },
        select: {
          email: true,
          username: true,
          notify_email_enabled: true,
          notify_email_assignments: true,
        },
      });

      if (assignee?.notify_email_enabled && assignee?.notify_email_assignments) {
        this.emailService.sendTaskAssignedEmail(
          assignee.email,
          assignee.username,
          dto.title,
          creator.username,
          this.getTaskLink(task.id),
        ).catch((err) => this.logger.error('Failed to send task assignment email:', err));
      }
    }

    return task;
  }


  async findAllByUser(userId: string, opts?: { status?: string; q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const where: Prisma.tasksWhereInput = {
      assignee_id: userId,
      is_archived: false,
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
          select: { id: true, username: true, email: true, avatar_color: true },
        },
        repos: {
          select: { id: true, name: true },
        },
        task_commits: {
          include: {
            commits: {
              select: { sha: true, message: true, author_login: true, committed_at: true },
            },
          },
        },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    // Check if user has manager access to the task's organization
    if (task.organization_id) {
      try {
        await this.organizationsService.checkAccess({ id: userId, role: userRole }, task.organization_id, ['admin', 'manager']);
        // If checkAccess passes, they are a manager/admin in that org (or global manager), so allow access
        return task;
      } catch (e) {
        // Not a manager in that org, fall through to personal check
      }
    }

    // Regular users can only view their own
    if (task.assignee_id !== userId) {
      throw new ForbiddenException('Not your task');
    }
    return task;
  }

  /**
   * Find task by readable_id (for commit linking)
   */
  async findByReadableId(readableId: number) {
    return this.prisma.tasks.findUnique({
      where: { readable_id: readableId },
    });
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
    if (!task) throw new NotFoundException('Task not found');

    // Verify manager is admin in the task's organization
    if (task.organization_id) {
      await this.organizationsService.checkAccess({ id: managerId, role: '' }, task.organization_id, ['admin', 'manager']);
    }

    // Already validated → do nothing
    if (task.validated_by) {
      throw new BadRequestException('Task already validated');
    }

    // Update task: set validated_by and move status from pending_validation to todo
    const updatedTask = await this.prisma.tasks.update({
      where: { id },
      data: {
        validated_by: managerId,
        status: task.status === 'pending_validation' ? 'todo' : task.status,
      },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
          },
        },
      },
    });

    // Create notification for assignee (if assignee != manager)
    if (task.assignee_id && task.assignee_id !== managerId) {
      await this.notificationsService.create({
        user_id: task.assignee_id,
        actor_id: managerId,
        type: 'TASK_VALIDATED',
        title: 'Task Approved',
        content: `Your task "${task.title}" has been approved.`,
        entity_id: task.id,
        entity_type: 'task',
      });
    }

    return updatedTask;
  }

  // Reject a task (manager only)
  async rejectTask(id: string, managerId: string, reason?: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    // Verify manager is admin in the task's organization
    if (task.organization_id) {
      await this.organizationsService.checkAccess({ id: managerId, role: '' }, task.organization_id, ['admin', 'manager']);
    }

    // Only pending_validation tasks can be rejected
    if (task.status !== 'pending_validation') {
      throw new BadRequestException('Only pending validation tasks can be rejected');
    }

    // Create notification for assignee
    if (task.assignee_id) {
      await this.notificationsService.create({
        user_id: task.assignee_id,
        actor_id: managerId,
        type: 'TASK_REJECTED',
        title: 'Task Rejected',
        content: reason || `Your task "${task.title}" was rejected`,
        entity_id: task.id,
        entity_type: 'task',
      });
    }

    // Delete the task
    return this.prisma.tasks.delete({ where: { id } });
  }



  async findAllByRole(user: any) {
    const where = user.role === 'manager'
      ? { is_archived: false }
      : { assignee_id: user.id, is_archived: false };

    return this.prisma.tasks.findMany({
      where,
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
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
      where: { assignee_id: userId, is_archived: false },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
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

    // Get tasks that either:
    // 1. Have organization_id matching directly, OR
    // 2. Have a repo that belongs to this organization
    // 3. Exclude archived tasks by default
    return this.prisma.tasks.findMany({
      where: {
        OR: [
          { organization_id: organizationId },
          { repo_id: { in: repoIds } },
        ],
        is_archived: false,
      },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
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
      pending_validation: allTasks.filter((t) => t.status === 'pending_validation'),
      todo: allTasks.filter((t) => t.status === 'todo'),
      pending: allTasks.filter((t) => t.status === 'pending'),
      in_progress: allTasks.filter((t) => t.status === 'in_progress'),
      done: allTasks.filter((t) => t.status === 'done'),
    };

    return {
      pending_validation: grouped.pending_validation,
      todo: grouped.todo,
      pending: grouped.pending,
      in_progress: grouped.in_progress,
      done: grouped.done,
      totals: {
        pending_validation: grouped.pending_validation.length,
        todo: grouped.todo.length,
        pending: grouped.pending.length,
        in_progress: grouped.in_progress.length,
        done: grouped.done.length,
        all: allTasks.length,
      },
    };
  }

  // Get tasks pending validation for a manager
  async getPendingValidationTasks(organizationId: string, managerId: string) {
    // Verify user is admin in this organization
    await this.organizationsService.checkAccess({ id: managerId, role: '' }, organizationId, ['admin', 'manager']);

    return this.prisma.tasks.findMany({
      where: {
        organization_id: organizationId,
        status: 'pending_validation',
        is_archived: false,
      },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar_color: true,
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

  async update(id: string, dto: any, user: any) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) throw new Error('Task not found');

    // Only manager or assignee can modify
    if (task.assignee_id !== user.id) {
      // If not assignee, check if manager/admin of the org
      if (task.organization_id) {
        await this.organizationsService.checkAccess(user, task.organization_id, ['admin', 'manager']);
      } else {
        // Task without org (shouldnt happen but defensive coding) -> global manager check? or just forbidden
        if (user.role !== 'manager') throw new ForbiddenException('No permission to modify this task');
      }
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

    // Get commenter info
    const commenter = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { username: true },
    });

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
            avatar_color: true,
          },
        },
      },
    });

    // Parse @mentions from content
    const mentionedUsernames = this.parseMentions(content);
    const mentionedUserIds = new Set<string>();

    if (mentionedUsernames.length > 0) {
      // Find users by username with their email preferences
      const mentionedUsers = await this.prisma.users.findMany({
        where: {
          username: { in: mentionedUsernames },
        },
        select: {
          id: true,
          username: true,
          email: true,
          notify_email_enabled: true,
          notify_email_mentions: true,
        },
      });

      // Create MENTION notifications for mentioned users (except commenter)
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id !== userId) {
          mentionedUserIds.add(mentionedUser.id);
          await this.notificationsService.create({
            user_id: mentionedUser.id,
            actor_id: userId,
            type: 'MENTION',
            title: 'You were mentioned',
            content: `Mentioned you in a comment on "${task.title}"`,
            entity_id: taskId,
            entity_type: 'task',
          });

          // Send mention email if enabled
          if (mentionedUser.notify_email_enabled && mentionedUser.notify_email_mentions) {
            this.emailService.sendMentionEmail(
              mentionedUser.email,
              mentionedUser.username,
              commenter?.username || 'Someone',
              task.title,
              content,
              this.getTaskLink(taskId),
            ).catch((err) => this.logger.error('Failed to send mention email:', err));
          }
        }
      }
    }

    // Create TASK_COMMENT notification for assignee if:
    // - Task has an assignee
    // - Commenter is NOT the assignee
    // - Assignee was NOT already mentioned (to avoid duplicate notifications)
    if (task.assignee_id && task.assignee_id !== userId && !mentionedUserIds.has(task.assignee_id)) {
      await this.notificationsService.create({
        user_id: task.assignee_id,
        actor_id: userId,
        type: 'TASK_COMMENT',
        title: 'New Comment',
        content: `Commented on "${task.title}"`,
        entity_id: taskId,
        entity_type: 'task',
      });

      // Send comment email if enabled
      const assignee = await this.prisma.users.findUnique({
        where: { id: task.assignee_id },
        select: {
          email: true,
          username: true,
          notify_email_enabled: true,
          notify_email_comments: true,
        },
      });

      if (assignee?.notify_email_enabled && assignee?.notify_email_comments) {
        this.emailService.sendTaskCommentEmail(
          assignee.email,
          assignee.username,
          task.title,
          commenter?.username || 'Someone',
          content,
          this.getTaskLink(taskId),
        ).catch((err) => this.logger.error('Failed to send comment email:', err));
      }

      // Also send the legacy chat notification for backwards compatibility
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

  /**
   * Parse @username mentions from content
   */
  private parseMentions(content: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)]; // Remove duplicates
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
            avatar_color: true,
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

  /**
   * Get comprehensive analytics for the Manager Zone dashboard
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  async getAnalytics(organizationId: string, managerId: string, period?: string) {
    // Verify user is manager in this organization
    const userOrg = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: managerId,
          organization_id: organizationId,
        },
      },
    });

    const role = userOrg?.role_in_org;
    if (!userOrg || (role !== 'admin' && role !== 'manager')) {
      throw new ForbiddenException('Only managers can view analytics');
    }

    // Calculate date filter based on period
    const now = new Date();
    let dateFilter: Date | undefined;

    switch (period) {
      case 'today':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        dateFilter = new Date(now);
        dateFilter.setDate(now.getDate() - now.getDay()); // Start of current week
        dateFilter.setHours(0, 0, 0, 0);
        break;
      case 'month':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        dateFilter = new Date(now);
        dateFilter.setMonth(now.getMonth() - 3);
        break;
      case 'all':
      default:
        dateFilter = undefined;
    }

    // Build where clause with optional date filter
    const whereClause: any = { organization_id: organizationId, is_archived: false };
    if (dateFilter) {
      whereClause.created_at = { gte: dateFilter };
    }

    // Get all tasks for this organization (with date filter)
    const allTasks = await this.prisma.tasks.findMany({
      where: whereClause,
      include: {
        users_tasks_assignee_idTousers: {
          select: { id: true, username: true, avatar_color: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Get team members
    const teamMembers = await this.prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      include: {
        users: {
          select: { id: true, username: true, avatar_color: true },
        },
      },
    });

    // Calculate KPIs
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'done').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    const pendingValidation = allTasks.filter(t => t.status === 'pending_validation').length;
    const todoTasks = allTasks.filter(t => t.status === 'todo').length;

    // Calculate completion rate
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate overdue tasks (reuse 'now' from above)
    const overdueTasks = allTasks.filter(t =>
      t.due_date && new Date(t.due_date) < now && t.status !== 'done'
    ).length;

    // Team Velocity: Tasks completed per week (last 8 weeks)
    const velocityData = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const completedThisWeek = allTasks.filter(t => {
        if (t.status !== 'done' || !t.created_at) return false;
        const createdAt = new Date(t.created_at);
        return createdAt >= weekStart && createdAt < weekEnd;
      }).length;

      velocityData.push({
        week: `W${8 - i}`,
        completed: completedThisWeek,
        weekStart: weekStart.toISOString().split('T')[0],
      });
    }

    // Distribution by status
    const statusDistribution = [
      { name: 'Completed', value: completedTasks, color: '#10b981' },
      { name: 'In Progress', value: inProgressTasks, color: '#3b82f6' },
      { name: 'To Do', value: todoTasks, color: '#6b7280' },
      { name: 'Pending Validation', value: pendingValidation, color: '#f59e0b' },
    ].filter(s => s.value > 0);

    // Individual performance: tasks per user
    const performanceMap = new Map<string, { id: string; username: string; avatar_color: string; completed: number; inProgress: number; total: number }>();

    for (const member of teamMembers) {
      if (member.users) {
        performanceMap.set(member.users.id, {
          id: member.users.id,
          username: member.users.username,
          avatar_color: member.users.avatar_color || 'zinc',
          completed: 0,
          inProgress: 0,
          total: 0,
        });
      }
    }

    for (const task of allTasks) {
      if (task.assignee_id && performanceMap.has(task.assignee_id)) {
        const user = performanceMap.get(task.assignee_id)!;
        user.total++;
        if (task.status === 'done') user.completed++;
        if (task.status === 'in_progress') user.inProgress++;
      }
    }

    const individualPerformance = Array.from(performanceMap.values())
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10);

    // Project Health: On-time vs Overdue (by priority areas)
    const healthData = [
      {
        name: 'On Track',
        onTime: allTasks.filter(t => t.status !== 'done' && (!t.due_date || new Date(t.due_date) >= now)).length,
        overdue: 0,
      },
      {
        name: 'At Risk',
        onTime: 0,
        overdue: overdueTasks,
      },
    ];

    // Recent activity: last 10 task updates
    const recentTasks = allTasks
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.users_tasks_assignee_idTousers?.username || 'Unassigned',
        created_at: t.created_at,
      }));

    // PREMIUM ANALYTICS: Calculate enhanced metrics and charts
    const doraMetrics = this.calculateDoraMetrics(allTasks);
    const riskScore = this.calculateRiskScore(allTasks, organizationId);
    const cfdData = this.generateSmoothCFD(allTasks);
    const investmentData = this.calculateInvestmentProfile(allTasks);
    const heatmapData = await this.analyzeWorkloadHeatmap(organizationId, allTasks);
    const burndownData = this.projectBurndownCone(allTasks);

    // Generate sparklines for KPI cards
    const completionRateSparkline: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCompleted = allTasks.filter(t => {
        if (t.status !== 'done' || !t.created_at) return false;
        const createdAt = new Date(t.created_at);
        return createdAt >= weekStart && createdAt < weekEnd;
      }).length;

      const weekTotal = allTasks.filter(t => {
        if (!t.created_at) return false;
        const createdAt = new Date(t.created_at);
        return createdAt >= weekStart && createdAt < weekEnd;
      }).length;

      const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
      completionRateSparkline.push(weekRate);
    }

    return {
      kpis: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingValidation,
        todoTasks,
        completionRate,
        overdueTasks,
        teamSize: teamMembers.length,
      },
      velocityData,
      statusDistribution,
      individualPerformance,
      healthData,
      recentTasks,
      // PREMIUM CHARTS: Enhanced visualizations
      premiumCharts: {
        cfd: cfdData,
        investment: investmentData,
        heatmap: heatmapData,
        burndown: burndownData,
        sparklines: {
          completionRate: completionRateSparkline,
          velocity: doraMetrics.sparklineData,
          cycleTime: doraMetrics.cycleTimeSparkline,
          riskScore: [riskScore], // Single value for now, could add historical tracking
        },
      },
    };
  }

  /**
   * PREMIUM ANALYTICS HELPERS
   * Methods below are used to generate premium chart data for Analytics Dashboard
   * Copied and adapted from ai.service.ts for reusability
   */

  /**
   * HELPER: Calculate Investment Profile (Task Classification)
   * Classifies tasks into Features, Bugs, and Chores based on title/description
   */
  private calculateInvestmentProfile(tasks: any[], userId?: string): {
    labels: string[];
    datasets: Array<{ label: string; data: number[]; color: string }>;
  } {
    // Filter tasks by user if userId is provided
    const filteredTasks = userId
      ? tasks.filter(t => t.assignee_id === userId)
      : tasks;

    const categories = { features: 0, bugs: 0, chores: 0 };

    for (const task of filteredTasks) {
      const text = `${task.title} ${task.description || ''}`.toLowerCase();
      if (text.match(/\b(fix|bug|issue|error|defect)\b/)) {
        categories.bugs++;
      } else if (text.match(/\b(feat|feature|add|new|implement|create)\b/)) {
        categories.features++;
      } else {
        categories.chores++;
      }
    }

    const total = filteredTasks.length || 1;
    return {
      labels: ['Features', 'Bugs', 'Chores'],
      datasets: [
        {
          label: 'Task Distribution',
          data: [
            Math.round((categories.features / total) * 100),
            Math.round((categories.bugs / total) * 100),
            Math.round((categories.chores / total) * 100),
          ],
          color: '#8b5cf6', // Purple
        },
      ],
    };
  }

  /**
   * HELPER: Calculate AI Risk Score (0-100)
   * Algorithm: Based on % completion vs time remaining + blockers + overdue
   * Higher score = Higher risk of delays
   */
  private calculateRiskScore(tasks: any[], organizationId: string): number {
    const now = Date.now();

    // Factor 1: Tasks with due dates approaching or overdue
    const tasksWithDueDate = tasks.filter(t => t.due_date && t.status !== 'done');
    const overdueTasks = tasksWithDueDate.filter(t => new Date(t.due_date).getTime() < now);
    const approachingDeadline = tasksWithDueDate.filter(t => {
      const daysUntilDue = (new Date(t.due_date).getTime() - now) / (1000 * 60 * 60 * 24);
      return daysUntilDue > 0 && daysUntilDue <= 7;
    });

    // Factor 2: WIP (Work In Progress) saturation
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const pendingValidation = tasks.filter(t => t.status === 'pending_validation').length;
    const totalActive = inProgress + pendingValidation;
    const wipSaturation = Math.min(100, (totalActive / Math.max(tasks.length * 0.3, 1)) * 100);

    // Factor 3: Completion rate
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 100;
    const completionRisk = 100 - completionRate;

    // Calculate weighted risk score
    const overdueWeight = overdueTasks.length * 15; // Each overdue task adds 15 points
    const approachingWeight = approachingDeadline.length * 8; // Each approaching deadline adds 8 points
    const wipWeight = wipSaturation * 0.3; // WIP saturation contributes 30%
    const completionWeight = completionRisk * 0.4; // Completion risk contributes 40%

    const riskScore = Math.min(100, overdueWeight + approachingWeight + wipWeight + completionWeight);

    return Math.round(riskScore);
  }

  /**
   * HELPER: Calculate DORA Metrics Lite + Sparklines for Velocity
   * - Deployment Frequency: Commits/PRs merged (approximation)
   * - Lead Time: Average time from creation to done
   * - Velocity Stability: Standard deviation of weekly completion
   */
  private calculateDoraMetrics(tasks: any[]): {
    deploymentFrequency: number;
    leadTimeAvg: number;
    velocityStability: number;
    sparklineData: number[];
    cycleTimeSparkline: number[];
    reviewEfficiencySparkline: number[];
  } {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const deploymentFrequency = completedTasks.length;

    // Calculate lead time (days from created_at to when status became 'done')
    const leadTimes = completedTasks
      .filter(t => t.created_at)
      .map(t => {
        // Approximation: use created_at to now (ideally we'd track status change timestamps)
        const created = new Date(t.created_at).getTime();
        const now = Date.now();
        return (now - created) / (1000 * 60 * 60 * 24); // days
      });

    const leadTimeAvg = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0;

    // Velocity Stability: Calculate weekly completion variance
    const weeklyCounts: number[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekTasks = completedTasks.filter(t => {
        if (!t.created_at) return false;
        const taskDate = new Date(t.created_at);
        return taskDate >= weekStart && taskDate < weekEnd;
      });
      weeklyCounts.push(weekTasks.length);
    }

    const mean = weeklyCounts.reduce((a, b) => a + b, 0) / weeklyCounts.length;
    const variance = weeklyCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyCounts.length;
    const stdDev = Math.sqrt(variance);
    const velocityStability = mean > 0 ? Math.round((1 - stdDev / mean) * 100) : 50; // Higher = more stable

    // Sparklines
    const sparklineData = weeklyCounts.slice(-10);
    const cycleTimeSparkline = leadTimes.slice(-10);

    // Review Efficiency: Approximate time in pending_validation
    const pendingTasks = tasks.filter(t => t.status === 'pending_validation');
    const reviewEfficiencySparkline = pendingTasks.slice(-10).map(t => {
      const created = new Date(t.created_at).getTime();
      const now = Date.now();
      return (now - created) / (1000 * 60 * 60); // hours
    });

    return {
      deploymentFrequency,
      leadTimeAvg,
      velocityStability,
      sparklineData,
      cycleTimeSparkline,
      reviewEfficiencySparkline,
    };
  }

  /**
   * HELPER: Generate Smooth Cumulative Flow Diagram Data
   * Reconstructs historical daily state distribution with CUMULATIVE stacking
   * Uses monotone interpolation for smooth curves (handled by Recharts)
   * NOTE: This is an approximation based on current data. Ideally needs a task_history table.
   */
  private generateSmoothCFD(tasks: any[]): Array<{
    date: string;
    done: number;
    review: number;
    in_progress: number;
    todo: number;
  }> {
    const now = new Date();
    const data: Array<{ date: string; done: number; review: number; in_progress: number; todo: number }> = [];

    // Generate last 30 days with cumulative stacking
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Simulate progress over time (dayFactor increases as we approach current day)
      const dayFactor = 1 - (i / 30);

      // Calculate cumulative values (bottom to top stacking)
      const doneCount = Math.round(tasks.filter(t => t.status === 'done').length * dayFactor);
      const reviewCount = Math.round(tasks.filter(t => t.status === 'pending_validation').length * dayFactor);
      const inProgressCount = Math.round(tasks.filter(t => t.status === 'in_progress').length * dayFactor);
      const todoCount = Math.round(tasks.filter(t => t.status === 'todo').length * (1 - dayFactor * 0.5));

      data.push({
        date: dateStr,
        done: doneCount,
        review: reviewCount,
        in_progress: inProgressCount,
        todo: todoCount,
      });
    }

    return data;
  }

  /**
   * HELPER: Analyze Workload Heatmap (GitHub-style)
   * Generates a matrix of activity intensity per user per day
   * @param organizationId - Organization to analyze
   * @param tasks - Array of tasks
   */
  private async analyzeWorkloadHeatmap(organizationId: string, tasks: any[]): Promise<{
    users: string[];
    days: string[];
    data: number[][];
  }> {
    // Get all team members
    const teamMembers = await this.prisma.user_organizations.findMany({
      where: { organization_id: organizationId },
      include: {
        users: {
          select: { id: true, username: true, github_login: true },
        },
      },
    });

    // Get recent commits for activity tracking
    const commits = await this.prisma.commits.findMany({
      where: {
        repos: {
          organization_id: organizationId,
        },
      },
      take: 500,
      orderBy: { committed_at: 'desc' },
    });

    // Generate last 14 days
    const now = new Date();
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }

    // Build heatmap matrix
    const users: string[] = [];
    const data: number[][] = [];

    for (const member of teamMembers) {
      if (!member.users) continue;

      users.push(member.users.username);
      const userActivity: number[] = [];

      for (const day of days) {
        const dayStart = new Date(day);
        const dayEnd = new Date(day);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // Count commits for this user on this day
        const userCommits = commits.filter(c => {
          if (!member.users?.github_login || !c.committed_at) return false;
          const commitDate = new Date(c.committed_at);
          return (
            c.author_login === member.users.github_login &&
            commitDate >= dayStart &&
            commitDate < dayEnd
          );
        });

        // Count task movements (approximation: tasks assigned to this user)
        const userTasks = tasks.filter(t => {
          if (t.assignee_id !== member.users?.id) return false;
          if (!t.created_at) return false;
          const taskDate = new Date(t.created_at);
          return taskDate >= dayStart && taskDate < dayEnd;
        });

        // Activity score: commits + task movements (weighted)
        const activityScore = userCommits.length * 3 + userTasks.length * 2;
        userActivity.push(activityScore);
      }

      data.push(userActivity);
    }

    return { users, days, data };
  }

  /**
   * HELPER: Project Burndown with Uncertainty Cone
   * Generates predictive burndown chart with optimistic/pessimistic scenarios
   * @param tasks - Array of tasks to analyze
   */
  private projectBurndownCone(tasks: any[]): {
    real: Array<{ day: number; tasks: number }>;
    ideal: Array<{ day: number; tasks: number }>;
    projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
  } {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const remainingTasks = totalTasks - completedTasks;

    // Calculate historical burndown (last 14 days)
    const now = new Date();
    const real: Array<{ day: number; tasks: number }> = [];

    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = date;
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Count tasks not yet completed at that point (approximation)
      const dayFactor = i / 14;
      const tasksRemaining = Math.round(remainingTasks + completedTasks * dayFactor);

      real.push({ day: 14 - i, tasks: tasksRemaining });
    }

    // Calculate ideal burndown (straight line from current to zero)
    const ideal: Array<{ day: number; tasks: number }> = [];
    const daysToComplete = 14; // Assume 2-week sprint
    for (let day = 0; day <= daysToComplete; day++) {
      const tasksLeft = Math.round(remainingTasks * (1 - day / daysToComplete));
      ideal.push({ day: 14 + day, tasks: tasksLeft });
    }

    // Calculate projection cone (optimistic and pessimistic scenarios)
    const projection: Array<{ day: number; optimistic: number; pessimistic: number }> = [];

    // Calculate velocity (tasks completed per day on average)
    const avgVelocity = real.length > 1
      ? (real[0].tasks - real[real.length - 1].tasks) / real.length
      : 1;

    const optimisticVelocity = avgVelocity * 1.3; // 30% faster
    const pessimisticVelocity = avgVelocity * 0.7; // 30% slower

    for (let day = 14; day <= 28; day++) {
      const daysAhead = day - 14;
      const optimisticRemaining = Math.max(0, remainingTasks - optimisticVelocity * daysAhead);
      const pessimisticRemaining = Math.max(0, remainingTasks - pessimisticVelocity * daysAhead);

      projection.push({
        day,
        optimistic: Math.round(optimisticRemaining),
        pessimistic: Math.round(pessimisticRemaining),
      });
    }

    return { real, ideal, projection };
  }

  /**
   * Archive a single task (soft delete)
   * Only managers or the task assignee can archive a task
   */
  async archiveTask(taskId: string, userId: string, userRole?: string) {
    const task = await this.prisma.tasks.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // Check permissions: Only managers or the assignee can archive
    let isManager = false;
    if (task.organization_id) {
      try {
        await this.organizationsService.checkAccess(
          { id: userId, role: userRole },
          task.organization_id,
          ['admin', 'manager']
        );
        isManager = true;
      } catch (e) {
        // Not a manager, continue to assignee check
      }
    }

    // If not a manager, must be the assignee
    if (!isManager && task.assignee_id !== userId) {
      throw new ForbiddenException('Only managers or assignees can archive tasks');
    }

    // Archive the task
    return this.prisma.tasks.update({
      where: { id: taskId },
      data: { is_archived: true },
    });
  }

  /**
   * Archive all completed (done) tasks in an organization
   * Only managers can perform this action
   */
  async archiveAllDone(organizationId: string, userId: string, userRole?: string) {
    // Verify user is manager in this organization
    await this.organizationsService.checkAccess(
      { id: userId, role: userRole },
      organizationId,
      ['admin', 'manager']
    );

    // Get all repos in organization
    const orgRepos = await this.prisma.repos.findMany({
      where: { organization_id: organizationId },
      select: { id: true },
    });

    const repoIds = orgRepos.map((r) => r.id);

    // Archive all done tasks in this organization
    const result = await this.prisma.tasks.updateMany({
      where: {
        OR: [
          { organization_id: organizationId },
          { repo_id: { in: repoIds } },
        ],
        status: 'done',
        is_archived: false,
      },
      data: { is_archived: true },
    });

    return { archived: result.count };
  }

  /**
   * Manually link a commit to a task
   */
  async linkCommit(taskId: string, commitSha: string, userId: string, userRole: string) {
    // Verify task exists and user has permissions
    await this.findOneOwned(taskId, userId, userRole);

    // Verify commit exists in database
    const commit = await this.prisma.commits.findUnique({
      where: { sha: commitSha },
    });

    if (!commit) {
      throw new NotFoundException('Commit not found in database. Please sync commits from GitHub first.');
    }

    // Check if link already exists
    const existingLink = await this.prisma.task_commits.findUnique({
      where: {
        task_id_commit_sha: {
          task_id: taskId,
          commit_sha: commitSha,
        },
      },
    });

    if (existingLink) {
      throw new BadRequestException('Commit is already linked to this task');
    }

    // Create the link
    await this.prisma.task_commits.create({
      data: {
        task_id: taskId,
        commit_sha: commitSha,
      },
    });

    // Return updated task with all linked commits
    return this.findOneOwned(taskId, userId, userRole);
  }
}

