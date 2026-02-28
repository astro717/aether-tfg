
import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
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
   * Generate a unique readable_id in the format PREFIX-HASH (e.g., AET-3M2KV9)
   * @param organizationId - The organization to get the prefix from
   */
  private async generateReadableId(organizationId: string): Promise<string> {
    // Get organization prefix
    const org = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { task_prefix: true, name: true },
    });

    // Use task_prefix if set, otherwise derive from org name
    const prefix = org?.task_prefix || org?.name?.substring(0, 3).toUpperCase() || 'TSK';

    // Generate 6-character alphanumeric hash (uppercase for aesthetics)
    const generateHash = (): string => {
      return randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    };

    // Ensure uniqueness with retry logic
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const hash = generateHash();
      const readableId = `${prefix}-${hash}`;

      // Check if this readable_id already exists
      const existing = await this.prisma.tasks.findUnique({
        where: { readable_id: readableId },
      });

      if (!existing) {
        return readableId;
      }

      attempts++;
    }

    // Fallback: use timestamp-based hash if random collisions persist
    const fallbackHash = Date.now().toString(36).toUpperCase().slice(-6);
    return `${prefix}-${fallbackHash}`;
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

    // Generate unique readable_id (e.g., AET-3M2KV9)
    const readableId = await this.generateReadableId(dto.organization_id);

    const data: any = {
      title: dto.title,
      description: dto.description,
      status: initialStatus,
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      repo_id: dto.repo_id || null,
      organization_id: dto.organization_id,
      assignee_id: dto.assignee_id,
      readable_id: readableId,
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
  async findByReadableId(readableId: string) {
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

  /**
   * Personal Pulse: weekly velocity, trend, and on-time rate for a single user.
   */
  async getMyPulse(userId: string) {
    const now = new Date();

    // Get start of current week (Monday)
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    currentWeekStart.setHours(0, 0, 0, 0);

    // Get start of last week (Monday)
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Get end of last week (Sunday)
    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setMilliseconds(-1);

    // Count tasks completed THIS week (status changed to done this week)
    const thisWeekDone = await this.prisma.tasks.count({
      where: {
        assignee_id: userId,
        status: 'done',
        updated_at: { gte: currentWeekStart },
      },
    });

    // Count tasks completed LAST week
    const lastWeekDone = await this.prisma.tasks.count({
      where: {
        assignee_id: userId,
        status: 'done',
        updated_at: {
          gte: lastWeekStart,
          lte: lastWeekEnd,
        },
      },
    });

    // Calculate on-time rate (done tasks where done before due_date)
    // Look at last 30 days of completed tasks
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completedWithDueDate = await this.prisma.tasks.findMany({
      where: {
        assignee_id: userId,
        status: 'done',
        due_date: { not: null },
        updated_at: { gte: thirtyDaysAgo },
      },
      select: {
        due_date: true,
        updated_at: true,
      },
    });

    const onTimeCount = completedWithDueDate.filter(
      (t) => t.updated_at && t.due_date && new Date(t.updated_at) <= new Date(t.due_date)
    ).length;

    const onTimeRate = completedWithDueDate.length > 0
      ? Math.round((onTimeCount / completedWithDueDate.length) * 100)
      : 100; // Default to 100% if no data

    // Get current task counts for progress bar
    const [todoCount, inProgressCount, doneCount] = await Promise.all([
      this.prisma.tasks.count({
        where: { assignee_id: userId, status: { in: ['todo', 'pending'] }, is_archived: false },
      }),
      this.prisma.tasks.count({
        where: { assignee_id: userId, status: 'in_progress', is_archived: false },
      }),
      this.prisma.tasks.count({
        where: { assignee_id: userId, status: 'done', is_archived: false },
      }),
    ]);

    return {
      weeklyVelocity: thisWeekDone,
      trend: thisWeekDone - lastWeekDone,
      onTimeRate,
      progress: {
        todo: todoCount,
        inProgress: inProgressCount,
        done: doneCount,
        total: todoCount + inProgressCount + doneCount,
      },
    };
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
   * Helper: Check if task status matches expected value (case-insensitive)
   */
  private isTaskStatus(task: any, expectedStatus: string): boolean {
    if (!task.status) return false;
    const normalizedStatus = task.status.toLowerCase();
    const normalizedExpected = expectedStatus.toLowerCase();

    // Handle 'done' and 'completed' as equivalent
    if (normalizedExpected === 'done') {
      return normalizedStatus === 'done' || normalizedStatus === 'completed';
    }

    return normalizedStatus === normalizedExpected;
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
    let endDate: Date | undefined;

    switch (period) {
      case 'today':
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case 'week':
        // Rolling 7-day window ending now
        dateFilter = new Date(now);
        dateFilter.setDate(now.getDate() - 7);
        dateFilter.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Rolling 30-day window ending now
        dateFilter = new Date(now);
        dateFilter.setDate(now.getDate() - 30);
        dateFilter.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        dateFilter = new Date(now);
        dateFilter.setMonth(now.getMonth() - 3);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'all':
      default:
        dateFilter = undefined;
        endDate = undefined;
    }

    // Build where clause to capture tasks created OR updated OR due during the period
    // This ensures we include tasks completed in the period even if created earlier
    // IMPORTANT: We include archived tasks to count all historical data
    const baseWhereClause: any = { organization_id: organizationId };

    const whereClause: any = { ...baseWhereClause };
    if (dateFilter) {
      // Fetch tasks that were either created OR updated OR due during the period
      whereClause.OR = [
        { created_at: { gte: dateFilter } },
        { updated_at: { gte: dateFilter } },
        { due_date: { gte: dateFilter, lte: endDate } },
      ];
    }

    // Get all tasks for this organization (created or updated in period)
    const allTasks = await this.prisma.tasks.findMany({
      where: whereClause,
      include: {
        users_tasks_assignee_idTousers: {
          select: { id: true, username: true, avatar_color: true },
        },
      },
      orderBy: { updated_at: 'desc' },
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

    // Separate tasks by creation vs completion
    // Total tasks = tasks CREATED in the period
    const createdTasks = dateFilter
      ? allTasks.filter(t => t.created_at && new Date(t.created_at) >= dateFilter)
      : allTasks;

    // Completed tasks = tasks with status 'done' AND updated in the period
    // (This captures completions that happened during the period)
    const completedInPeriod = dateFilter
      ? allTasks.filter(t => this.isTaskStatus(t, 'done') && t.updated_at && new Date(t.updated_at) >= dateFilter)
      : allTasks.filter(t => this.isTaskStatus(t, 'done'));

    // Calculate KPIs
    const totalTasks = createdTasks.length;
    const completedTasks = completedInPeriod.length;
    const inProgressTasks = allTasks.filter(t => this.isTaskStatus(t, 'in_progress')).length;

    // SNAPSHOT METRICS: These metrics reflect the current state of the organization
    // and are NOT filtered by the selected time period (dateFilter is ignored)

    // Pending Validation Snapshot: Current count of tasks awaiting review
    const pendingValidation = await this.prisma.tasks.count({
      where: {
        organization_id: organizationId,
        status: 'pending_validation',
        is_archived: false,
      },
    });

    // To Do Snapshot: Current count of all incomplete tasks (global backlog)
    const todoTasks = await this.prisma.tasks.count({
      where: {
        organization_id: organizationId,
        is_archived: false,
        status: { notIn: ['done', 'completed', 'Done', 'Completed'] },
      },
    });

    // Overdue Snapshot: Current count of tasks past their due date
    const overdueTasks = await this.prisma.tasks.count({
      where: {
        organization_id: organizationId,
        is_archived: false,
        due_date: { lt: now },
        status: { notIn: ['done', 'completed', 'Done', 'Completed'] },
      },
    });

    // In Progress Snapshot: Current count of tasks actively being worked on
    const inProgressSnapshot = await this.prisma.tasks.count({
      where: {
        organization_id: organizationId,
        status: 'in_progress',
        is_archived: false,
      },
    });

    // Calculate completion rate (tasks completed vs created in period)
    const completionRate = totalTasks > 0 ? Math.round((completedInPeriod.length / totalTasks) * 100) : 0;

    // On-Time Delivery Rate: Percentage of completed tasks delivered before their due date
    // Tasks without due_date are counted as on-time by default
    let onTimeCount = 0;
    for (const t of completedInPeriod) {
      if (!t.due_date) {
        // No deadline = on-time by default
        onTimeCount++;
      } else if (t.updated_at) {
        const completedAt = new Date(t.updated_at).getTime();
        const dueAt = new Date(t.due_date).getTime();
        if (completedAt <= dueAt) {
          onTimeCount++;
        }
      }
    }
    const onTimeRate = completedInPeriod.length > 0
      ? Math.round((onTimeCount / completedInPeriod.length) * 100)
      : 100; // No tasks = 100% on-time (avoid false negatives)

    // Team Velocity: Tasks completed per week (last 8 weeks)
    // Uses updated_at to track when tasks were actually completed
    const velocityData = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const completedThisWeek = allTasks.filter(t => {
        if (!this.isTaskStatus(t, 'done') || !t.updated_at) return false;
        const updatedAt = new Date(t.updated_at);
        return updatedAt >= weekStart && updatedAt < weekEnd;
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

    // NEW: Get absolute inProgress count for all users in the org
    const absoluteInProgress = await this.prisma.tasks.groupBy({
      by: ['assignee_id'],
      where: {
        organization_id: organizationId,
        status: 'in_progress',
        is_archived: false,
        assignee_id: { not: null }
      },
      _count: { _all: true },
    });

    for (const group of absoluteInProgress) {
      if (group.assignee_id && performanceMap.has(group.assignee_id)) {
        performanceMap.get(group.assignee_id)!.inProgress = group._count._all;
      }
    }

    // Count metrics from allTasks (tasks active in period)
    for (const task of allTasks) {
      if (task.assignee_id && performanceMap.has(task.assignee_id)) {
        const user = performanceMap.get(task.assignee_id)!;

        // Total: tasks created in period
        if (!dateFilter || (task.created_at && new Date(task.created_at) >= dateFilter)) {
          user.total++;
        }

        // Completed: tasks completed (updated) in period
        if (this.isTaskStatus(task, 'done') && (!dateFilter || (task.updated_at && new Date(task.updated_at) >= dateFilter))) {
          user.completed++;
        }
      }
    }

    const individualPerformance = Array.from(performanceMap.values())
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10);

    // Project Health: On-time vs Overdue (by priority areas)
    const healthData = [
      {
        name: 'On Track',
        onTime: allTasks.filter(t => !this.isTaskStatus(t, 'done') && (!t.due_date || new Date(t.due_date) >= now)).length,
        overdue: 0,
      },
      {
        name: 'At Risk',
        onTime: 0,
        overdue: overdueTasks,
      },
    ];

    // Recent activity — period-aware
    // For 'today': run a dedicated query that captures every "signal of life" today
    // (updated_at, created_at, linked commits, comments, or simply in_progress status).
    // This replaces the old simulation-based approach and returns real activity dates.
    let recentTasks: Array<{
      id: string;
      title: string;
      status: string | null;
      assignee: string;
      created_at: Date | null;
      updated_at: Date;
      due_date?: Date | null;
      latestCommitDate?: Date | null;
      latestCommentDate?: Date | null;
    }>;

    if (period === 'today') {
      const todayStartForActive = new Date();
      todayStartForActive.setHours(0, 0, 0, 0);

      const activeTasks = await this.prisma.tasks.findMany({
        where: {
          organization_id: organizationId,
          is_archived: false,
          OR: [
            { updated_at: { gte: todayStartForActive } },
            { created_at: { gte: todayStartForActive } },
            // Commit linked to this task committed today
            { task_commits: { some: { commits: { committed_at: { gte: todayStartForActive } } } } },
            // Comment left on this task today
            { task_comments: { some: { created_at: { gte: todayStartForActive } } } },
            // Silently in-progress tasks (no touch needed to be relevant)
            { status: 'in_progress' },
          ],
        },
        include: {
          users_tasks_assignee_idTousers: {
            select: { id: true, username: true, avatar_color: true },
          },
          // Latest linked commit (ordered by linked_at as proxy for committed_at)
          task_commits: {
            include: {
              commits: { select: { committed_at: true } },
            },
            orderBy: { linked_at: 'desc' },
            take: 1,
          },
          // Latest comment
          task_comments: {
            select: { created_at: true },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
        take: 20,
      });

      recentTasks = activeTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.users_tasks_assignee_idTousers?.username || 'Unassigned',
        created_at: t.created_at,
        updated_at: t.updated_at,
        due_date: t.due_date,
        latestCommitDate: t.task_commits[0]?.commits?.committed_at ?? null,
        latestCommentDate: t.task_comments[0]?.created_at ?? null,
      }));
    } else {
      recentTasks = allTasks
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 10)
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assignee: t.users_tasks_assignee_idTousers?.username || 'Unassigned',
          created_at: t.created_at,
          updated_at: t.updated_at,
        }));
    }

    // PREMIUM ANALYTICS: Calculate enhanced metrics and charts (period-aware)
    const normalizedPeriod = period || 'week';
    const doraMetrics = this.calculateDoraMetrics(allTasks);

    // Risk Score: Calculated from truly ACTIVE tasks only (todo + in_progress)
    // Excludes 'done' (completed) and 'pending_validation' (ideas not yet approved)
    // This prevents false low-risk readings when filtering to short time windows
    const globalActiveTasks = await this.prisma.tasks.findMany({
      where: {
        organization_id: organizationId,
        is_archived: false,
        status: { in: ['todo', 'in_progress'] },
      },
    });
    const riskScore = this.calculateRiskScore(globalActiveTasks, organizationId);
    const cfdData = this.generateSmoothCFD(allTasks, normalizedPeriod);
    const investmentData = this.calculateInvestmentProfile(allTasks);
    const heatmapData = await this.analyzeWorkloadHeatmap(organizationId, allTasks, normalizedPeriod);
    const burndownData = this.projectBurndownCone(allTasks, normalizedPeriod);

    // Generate sparklines for KPI cards (based on completion vs creation)
    const completionRateSparkline: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      // Tasks completed (based on updated_at) in this week
      const weekCompleted = allTasks.filter(t => {
        if (!this.isTaskStatus(t, 'done') || !t.updated_at) return false;
        const updatedAt = new Date(t.updated_at);
        return updatedAt >= weekStart && updatedAt < weekEnd;
      }).length;

      // Tasks created in this week
      const weekTotal = allTasks.filter(t => {
        if (!t.created_at) return false;
        const createdAt = new Date(t.created_at);
        return createdAt >= weekStart && createdAt < weekEnd;
      }).length;

      const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
      completionRateSparkline.push(weekRate);
    }

    // Calculate precise average cycle time for tasks completed WITHIN the selected period
    const cycleTimesInPeriod: number[] = [];
    for (const t of completedInPeriod) {
      if (t.created_at && t.updated_at) {
        const created = new Date(t.created_at).getTime();
        const completed = new Date(t.updated_at).getTime();
        if (completed >= created) {
          cycleTimesInPeriod.push((completed - created) / (1000 * 60 * 60 * 24));
        }
      }
    }
    const periodCycleTimeAvg = cycleTimesInPeriod.length > 0
      ? parseFloat((cycleTimesInPeriod.reduce((a, b) => a + b, 0) / cycleTimesInPeriod.length).toFixed(1))
      : 0;

    return {
      kpis: {
        totalTasks,
        completedTasks,
        inProgressTasks: inProgressSnapshot,
        pendingValidation,
        todoTasks,
        completionRate,
        overdueTasks,
        teamSize: teamMembers.length,
        cycleTime: periodCycleTimeAvg,
        onTimeRate,
        riskScore,
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
   * HELPER: Get Time Buckets for Period-Aware Visualizations
   * Returns an array of timestamps/labels based on the selected period
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private getTimeBuckets(period: string): { timestamps: Date[]; labels: string[]; granularity: string } {
    const now = new Date();
    const timestamps: Date[] = [];
    const labels: string[] = [];
    let granularity = 'day';

    switch (period) {
      case 'today':
        // Hourly buckets (last 24 hours: 00:00, 01:00, ..., 23:00)
        granularity = 'hour';
        for (let hour = 0; hour < 24; hour++) {
          const bucket = new Date(now);
          bucket.setHours(hour, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        break;

      case 'week':
        // Daily buckets for rolling last 7 days
        granularity = 'day';
        for (let i = 6; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - i);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`${bucket.getMonth() + 1}/${bucket.getDate()}`);
        }
        break;

      case 'month':
        // Daily buckets (last 30 days: 1, 5, 10, 15, 20, 25, 30)
        granularity = 'day';
        for (let i = 29; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - i);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`${bucket.getMonth() + 1}/${bucket.getDate()}`);
        }
        break;

      case 'quarter':
        // Weekly buckets (last ~13 weeks: Week 1, Week 2, ...)
        granularity = 'week';
        for (let i = 12; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setDate(bucket.getDate() - (i * 7));
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          labels.push(`W${13 - i}`);
        }
        break;

      case 'all':
      default:
        // Monthly buckets (last 12 months)
        granularity = 'month';
        for (let i = 11; i >= 0; i--) {
          const bucket = new Date(now);
          bucket.setMonth(bucket.getMonth() - i);
          bucket.setDate(1);
          bucket.setHours(0, 0, 0, 0);
          timestamps.push(bucket);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          labels.push(monthNames[bucket.getMonth()]);
        }
        break;
    }

    return { timestamps, labels, granularity };
  }

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
   * Algorithm: Weighted sum of actionable risk factors for ACTIVE tasks
   * Input: Only 'todo' and 'in_progress' tasks (no 'done' or 'pending_validation')
   *
   * Risk Factors:
   * - Overdue tasks: highest risk (exponential weight, capped at 60)
   * - Approaching deadlines (7 days): moderate risk (capped at 25)
   * - High WIP ratio: capacity risk (capped at 25)
   * - Tasks without due dates: planning risk (capped at 15)
   *
   * Score Interpretation:
   * - 0-20: Healthy (green)
   * - 21-40: Low risk (green)
   * - 41-70: Moderate (amber)
   * - 71-100: High risk (red)
   */
  private calculateRiskScore(tasks: any[], _organizationId: string): number {
    // Edge case: no active tasks = no risk
    if (tasks.length === 0) {
      return 0;
    }

    const now = Date.now();

    // === FACTOR 1: Overdue Tasks (capped at 60 points) ===
    // Exponential weight: first 2 add 15 each, next 3 add 10 each, rest add 5 each
    const tasksWithDueDate = tasks.filter(t => t.due_date);
    const overdueTasks = tasksWithDueDate.filter(t => new Date(t.due_date).getTime() < now);
    const overdueCount = overdueTasks.length;

    let overdueScore = 0;
    if (overdueCount > 0) {
      // First 2 overdue: 15 points each
      const tier1 = Math.min(overdueCount, 2);
      overdueScore += tier1 * 15;

      // Next 3 overdue (3-5): 10 points each
      const tier2 = Math.min(Math.max(overdueCount - 2, 0), 3);
      overdueScore += tier2 * 10;

      // Remaining overdue (6+): 5 points each
      const tier3 = Math.max(overdueCount - 5, 0);
      overdueScore += tier3 * 5;
    }
    overdueScore = Math.min(overdueScore, 60);

    // === FACTOR 2: Approaching Deadlines (capped at 25 points) ===
    // Tasks due within 7 days: 5 points each
    const approachingDeadline = tasksWithDueDate.filter(t => {
      const daysUntilDue = (new Date(t.due_date).getTime() - now) / (1000 * 60 * 60 * 24);
      return daysUntilDue > 0 && daysUntilDue <= 7;
    });
    const approachingScore = Math.min(approachingDeadline.length * 5, 25);

    // === FACTOR 3: WIP Saturation (capped at 25 points) ===
    // Risk when in_progress tasks exceed 50% of total active tasks
    const inProgressCount = tasks.filter(t => this.isTaskStatus(t, 'in_progress')).length;
    const wipRatio = inProgressCount / tasks.length;
    let wipScore = 0;
    if (wipRatio > 0.5) {
      // Scale linearly from 0 to 25 as WIP goes from 50% to 100%
      wipScore = Math.round(((wipRatio - 0.5) / 0.5) * 25);
    }

    // === FACTOR 4: Missing Due Dates (capped at 15 points) ===
    // Tasks without due dates indicate poor planning: 3 points each
    const missingDueDateCount = tasks.filter(t => !t.due_date).length;
    const missingDueDateScore = Math.min(missingDueDateCount * 3, 15);

    // === FINAL SCORE ===
    const totalScore = overdueScore + approachingScore + wipScore + missingDueDateScore;

    return Math.min(100, Math.round(totalScore));
  }

  /**
   * HELPER: Calculate DORA Metrics Lite + Sparklines for Velocity
   * - Deployment Frequency: Commits/PRs merged (approximation)
   * - Lead Time: Average time from creation to done
   * - Velocity Rate: Period-over-period growth rate (last 7 days vs previous 7 days)
   * - On-Time Delivery: % of completed tasks delivered before due_date
   */
  private calculateDoraMetrics(tasks: any[]): {
    deploymentFrequency: number;
    leadTimeAvg: number;
    velocityRate: number;
    onTimeDeliveryRate: number;
    sparklineData: number[];
    cycleTimeSparkline: number[];
    onTimeSparkline: number[];
  } {
    const completedTasks = tasks.filter(t => this.isTaskStatus(t, 'done'));
    const deploymentFrequency = completedTasks.length;

    // Calculate lead time (days from created_at to completion)
    const leadTimes: number[] = [];
    for (const t of completedTasks) {
      if (t.created_at && t.updated_at) {
        const created = new Date(t.created_at).getTime();
        const completed = new Date(t.updated_at).getTime();
        if (completed >= created) {
          leadTimes.push((completed - created) / (1000 * 60 * 60 * 24)); // days
        }
      }
    }

    const leadTimeAvg = leadTimes.length > 0
      ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
      : 0;

    // Velocity Rate: Period-over-Period comparison (last 7 days vs previous 7 days)
    const now = new Date();

    // Period A: Last 7 days
    const periodAStart = new Date(now);
    periodAStart.setDate(periodAStart.getDate() - 7);
    periodAStart.setHours(0, 0, 0, 0);

    // Period B: Previous 7 days (days 8-14 ago)
    const periodBStart = new Date(now);
    periodBStart.setDate(periodBStart.getDate() - 14);
    periodBStart.setHours(0, 0, 0, 0);
    const periodBEnd = new Date(periodAStart);

    // Count tasks completed (updated_at) in each period
    const periodACompleted = completedTasks.filter(t => {
      if (!t.updated_at) return false;
      const updatedAt = new Date(t.updated_at);
      return updatedAt >= periodAStart && updatedAt < now;
    }).length;

    const periodBCompleted = completedTasks.filter(t => {
      if (!t.updated_at) return false;
      const updatedAt = new Date(t.updated_at);
      return updatedAt >= periodBStart && updatedAt < periodBEnd;
    }).length;

    // Calculate velocity rate: ((A - B) / B) * 100
    let velocityRate: number;
    if (periodBCompleted === 0 && periodACompleted > 0) {
      velocityRate = 100; // Infinite growth capped at 100%
    } else if (periodBCompleted === 0 && periodACompleted === 0) {
      velocityRate = 0; // No change
    } else {
      velocityRate = Math.round(((periodACompleted - periodBCompleted) / periodBCompleted) * 100);
    }

    // On-Time Delivery Rate: % of completed tasks delivered before/on due_date
    let onTimeCount = 0;
    let tasksWithDueDate = 0;

    for (const t of completedTasks) {
      if (t.due_date) {
        tasksWithDueDate++;
        if (t.updated_at) {
          const completedAt = new Date(t.updated_at).getTime();
          const dueAt = new Date(t.due_date).getTime();
          if (completedAt <= dueAt) {
            onTimeCount++;
          }
        }
      }
    }

    const onTimeDeliveryRate = tasksWithDueDate > 0
      ? Math.round((onTimeCount / tasksWithDueDate) * 100)
      : 100; // No tasks with deadlines = 100% on-time

    // Sparklines for velocity (weekly completion counts for last 8 weeks)
    const weeklyCounts: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCompleted = completedTasks.filter(t => {
        if (!t.updated_at) return false;
        const updatedAt = new Date(t.updated_at);
        return updatedAt >= weekStart && updatedAt < weekEnd;
      }).length;
      weeklyCounts.push(weekCompleted);
    }

    const sparklineData = weeklyCounts;
    const cycleTimeSparkline = leadTimes.slice(-10);

    // On-Time Delivery Sparkline (weekly on-time rates for last 8 weeks)
    const onTimeSparkline: number[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekCompleted = completedTasks.filter(t => {
        if (!t.updated_at) return false;
        const updatedAt = new Date(t.updated_at);
        return updatedAt >= weekStart && updatedAt < weekEnd;
      });

      let weekOnTime = 0;
      let weekWithDueDate = 0;
      for (const t of weekCompleted) {
        if (t.due_date) {
          weekWithDueDate++;
          const completedAt = new Date(t.updated_at).getTime();
          const dueAt = new Date(t.due_date).getTime();
          if (completedAt <= dueAt) {
            weekOnTime++;
          }
        }
      }

      const weekRate = weekWithDueDate > 0 ? Math.round((weekOnTime / weekWithDueDate) * 100) : 100;
      onTimeSparkline.push(weekRate);
    }

    return {
      deploymentFrequency,
      leadTimeAvg,
      velocityRate,
      onTimeDeliveryRate,
      sparklineData,
      cycleTimeSparkline,
      onTimeSparkline,
    };
  }

  /**
   * HELPER: Generate deterministic pseudo-random noise for CFD
   * Uses simple seeded random to create reproducible but realistic-looking variation
   */
  private seededNoise(seed: number, amplitude: number): number {
    const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
    const rand = x - Math.floor(x); // 0 to 1
    return Math.round((rand - 0.5) * 2 * amplitude); // -amplitude to +amplitude
  }

  /**
   * HELPER: Generate Smooth Cumulative Flow Diagram Data (Period-Aware)
   * Reconstructs historical state distribution with CUMULATIVE stacking
   * Includes realistic noise to simulate async team work patterns
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   * NOTE: This is an approximation based on current data. Ideally needs a task_history table.
   */
  private generateSmoothCFD(tasks: any[], period: string = 'week'): Array<{
    date: string;
    done: number;
    in_progress: number;
    todo: number;
  }> {
    const { timestamps } = this.getTimeBuckets(period);
    const data: Array<{ date: string; done: number; in_progress: number; todo: number }> = [];

    const totalBuckets = timestamps.length;

    // Base counts for each status
    const baseDone = tasks.filter(t => this.isTaskStatus(t, 'done')).length;
    const baseInProgress = tasks.filter(t => this.isTaskStatus(t, 'in_progress')).length;
    const baseTodo = tasks.filter(t => this.isTaskStatus(t, 'todo')).length;

    // Noise amplitude scales with task count (more tasks = more variation)
    const noiseScale = Math.max(1, Math.floor(Math.sqrt(tasks.length) * 0.3));

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];

      // Use ISO string for today (hourly), otherwise use date only
      const dateStr = period === 'today'
        ? timestamp.toISOString()
        : timestamp.toISOString().split('T')[0];

      // Simulate progress over time (progressFactor increases as we approach current time)
      const progressFactor = i / Math.max(totalBuckets - 1, 1);

      // Add realistic noise: simulates async work patterns (sprints, weekends, etc.)
      const doneNoise = this.seededNoise(i * 7 + 1, noiseScale);
      const inProgressNoise = this.seededNoise(i * 7 + 2, noiseScale);
      const todoNoise = this.seededNoise(i * 7 + 3, noiseScale);

      // Calculate cumulative values with noise (ensure non-negative)
      const doneCount = Math.max(0, Math.round(baseDone * progressFactor) + doneNoise);
      const inProgressCount = Math.max(0, Math.round(baseInProgress * progressFactor) + inProgressNoise);
      const todoCount = Math.max(0, Math.round(baseTodo * (1 - progressFactor * 0.5)) + todoNoise);

      data.push({
        date: dateStr,
        done: doneCount,
        in_progress: inProgressCount,
        todo: todoCount,
      });
    }

    return data;
  }

  /**
   * HELPER: Analyze Workload Heatmap (GitHub-style, Period-Aware)
   * Generates a matrix of activity intensity per user per time period
   * @param organizationId - Organization to analyze
   * @param tasks - Array of tasks
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private async analyzeWorkloadHeatmap(organizationId: string, tasks: any[], period: string = 'week'): Promise<{
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

    // Get period-aware time buckets
    const { timestamps, labels, granularity } = this.getTimeBuckets(period);
    const days: string[] = [];

    // Format labels based on granularity
    for (let i = 0; i < timestamps.length; i++) {
      if (granularity === 'hour') {
        // For hourly: use labels like "09:00"
        days.push(labels[i]);
      } else if (granularity === 'day') {
        // For daily: use date string
        days.push(timestamps[i].toISOString().split('T')[0]);
      } else {
        // For week/month: use labels like "W1", "Jan"
        days.push(labels[i]);
      }
    }

    // Build heatmap matrix
    const users: string[] = [];
    const data: number[][] = [];

    for (const member of teamMembers) {
      if (!member.users) continue;

      users.push(member.users.username);
      const userActivity: number[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        const bucketStart = timestamps[i];
        const bucketEnd = new Date(bucketStart);

        // Determine bucket end based on granularity
        if (granularity === 'hour') {
          bucketEnd.setHours(bucketEnd.getHours() + 1);
        } else if (granularity === 'day') {
          bucketEnd.setDate(bucketEnd.getDate() + 1);
        } else if (granularity === 'week') {
          bucketEnd.setDate(bucketEnd.getDate() + 7);
        } else if (granularity === 'month') {
          bucketEnd.setMonth(bucketEnd.getMonth() + 1);
        }

        // Count commits for this user in this bucket
        const userCommits = commits.filter(c => {
          if (!member.users?.github_login || !c.committed_at) return false;
          const commitDate = new Date(c.committed_at);
          return (
            c.author_login === member.users.github_login &&
            commitDate >= bucketStart &&
            commitDate < bucketEnd
          );
        });

        // Count task movements (approximation: tasks assigned to this user)
        const userTasks = tasks.filter(t => {
          if (t.assignee_id !== member.users?.id) return false;
          if (!t.created_at) return false;
          const taskDate = new Date(t.created_at);
          return taskDate >= bucketStart && taskDate < bucketEnd;
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
   * HELPER: Project Burndown with Uncertainty Cone (Period-Aware)
   * Generates predictive burndown chart with optimistic/pessimistic scenarios
   * @param tasks - Array of tasks to analyze
   * @param period - 'today' | 'week' | 'month' | 'quarter' | 'all'
   */
  private projectBurndownCone(tasks: any[], period: string = 'week'): {
    real: Array<{ day: number; tasks: number }>;
    ideal: Array<{ day: number; tasks: number }>;
    projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
  } {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => this.isTaskStatus(t, 'done')).length;
    const remainingTasks = totalTasks - completedTasks;

    // Determine historical and projection periods based on selected period
    let historicalPeriods = 14; // default: 2 weeks
    let projectionPeriods = 14; // default: 2 weeks ahead

    switch (period) {
      case 'today':
        historicalPeriods = 12; // Last 12 hours
        projectionPeriods = 12; // Next 12 hours
        break;
      case 'week':
        historicalPeriods = 7; // Last 7 days
        projectionPeriods = 7; // Next 7 days
        break;
      case 'month':
        historicalPeriods = 30; // Last 30 days
        projectionPeriods = 30; // Next 30 days
        break;
      case 'quarter':
        historicalPeriods = 13; // Last 13 weeks
        projectionPeriods = 13; // Next 13 weeks
        break;
      case 'all':
        historicalPeriods = 12; // Last 12 months
        projectionPeriods = 6; // Next 6 months
        break;
    }

    // Calculate historical burndown
    const real: Array<{ day: number; tasks: number }> = [];

    for (let i = historicalPeriods - 1; i >= 0; i--) {
      // Count tasks not yet completed at that point (approximation)
      const progressFactor = i / historicalPeriods;
      const tasksRemaining = Math.round(remainingTasks + completedTasks * progressFactor);

      real.push({ day: historicalPeriods - i - 1, tasks: tasksRemaining });
    }

    // Calculate ideal burndown (straight line from current to zero)
    const ideal: Array<{ day: number; tasks: number }> = [];
    for (let day = 0; day <= projectionPeriods; day++) {
      const tasksLeft = Math.round(remainingTasks * (1 - day / projectionPeriods));
      ideal.push({ day: historicalPeriods + day - 1, tasks: tasksLeft });
    }

    // Calculate projection cone (optimistic and pessimistic scenarios)
    const projection: Array<{ day: number; optimistic: number; pessimistic: number }> = [];

    // Calculate velocity (tasks completed per period on average)
    const avgVelocity = real.length > 1
      ? (real[0].tasks - real[real.length - 1].tasks) / real.length
      : 1;

    const optimisticVelocity = avgVelocity * 1.3; // 30% faster
    const pessimisticVelocity = avgVelocity * 0.7; // 30% slower

    for (let day = historicalPeriods - 1; day < historicalPeriods + projectionPeriods; day++) {
      const periodsAhead = day - (historicalPeriods - 1);
      const optimisticRemaining = Math.max(0, remainingTasks - optimisticVelocity * periodsAhead);
      const pessimisticRemaining = Math.max(0, remainingTasks - pessimisticVelocity * periodsAhead);

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
   * Get real historical CFD data from daily_metrics table.
   * @param organizationId - Organization to query
   * @param range - '30d' | '90d' | 'all'
   */
  async getDailyMetrics(organizationId: string, range: string): Promise<Array<{
    date: string;
    done: number;
    in_progress: number;
    todo: number;
  }>> {
    // Step 1: Calculate exact startDate and endDate (today)
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    let startDate: Date;
    let daysAgo: number | null = null;

    if (range === '7d') daysAgo = 7;
    else if (range === '30d') daysAgo = 30;
    else if (range === '90d') daysAgo = 90;

    if (daysAgo !== null) {
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - daysAgo);
    } else {
      // 'all' → fetch oldest record to determine startDate
      const oldest = await this.prisma.daily_metrics.findFirst({
        where: { organization_id: organizationId },
        orderBy: { date: 'asc' },
      });
      if (!oldest) return [];
      startDate = new Date(oldest.date);
      startDate.setHours(0, 0, 0, 0);
    }

    // Step 2: Fetch raw metrics within range + last record before startDate for base state
    const [metricsInRange, baseMetric] = await Promise.all([
      this.prisma.daily_metrics.findMany({
        where: {
          organization_id: organizationId,
          date: { gte: startDate, lte: endDate },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.daily_metrics.findFirst({
        where: {
          organization_id: organizationId,
          date: { lt: startDate },
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    // Build a lookup map for quick access by date string
    const metricsMap = new Map<string, { done: number; in_progress: number; todo: number }>();
    for (const m of metricsInRange) {
      const dateStr = (m.date as Date).toISOString().split('T')[0];
      metricsMap.set(dateStr, {
        done: m.done_count,
        in_progress: m.in_progress_count,
        todo: m.todo_count,
      });
    }

    // Step 3 & 4: Iterate continuously from startDate to endDate, forward-filling gaps
    const result: Array<{ date: string; done: number; in_progress: number; todo: number }> = [];

    // Initialize carry-forward values from base metric or zeros
    let lastKnown = baseMetric
      ? { done: baseMetric.done_count, in_progress: baseMetric.in_progress_count, todo: baseMetric.todo_count }
      : { done: 0, in_progress: 0, todo: 0 };

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existing = metricsMap.get(dateStr);

      if (existing) {
        lastKnown = existing;
      }

      result.push({
        date: dateStr,
        ...lastKnown,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
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

  /**
   * Lightweight endpoint for Daily Pulse widget (Today view only)
   * Returns active tasks with minimal overhead — no heavy analytics computation
   */
  async getDailyPulse(organizationId: string, managerId: string) {
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
      throw new ForbiddenException('Only managers can view daily pulse');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Optimized query: only tasks with "signs of life" today or in_progress
    const rawTasks = await this.prisma.tasks.findMany({
      where: {
        organization_id: organizationId,
        is_archived: false,
        OR: [
          { updated_at: { gte: todayStart } },
          { created_at: { gte: todayStart } },
          { task_commits: { some: { commits: { committed_at: { gte: todayStart } } } } },
          { task_comments: { some: { created_at: { gte: todayStart } } } },
          { status: 'in_progress' },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        created_at: true,
        updated_at: true,
        due_date: true,
        users_tasks_assignee_idTousers: {
          select: { id: true, username: true, avatar_color: true },
        },
        task_commits: {
          select: {
            commits: { select: { committed_at: true } },
          },
          orderBy: { linked_at: 'desc' },
          take: 1,
        },
        task_comments: {
          select: { created_at: true },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      take: 30,
    });

    return {
      recentTasks: rawTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.users_tasks_assignee_idTousers?.username || 'Unassigned',
        assigneeId: t.users_tasks_assignee_idTousers?.id,
        assigneeAvatarColor: t.users_tasks_assignee_idTousers?.avatar_color,
        created_at: t.created_at,
        updated_at: t.updated_at,
        due_date: t.due_date,
        latestCommitDate: t.task_commits[0]?.commits?.committed_at ?? null,
        latestCommentDate: t.task_comments[0]?.created_at ?? null,
      })),
    };
  }
}

