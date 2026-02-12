
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

    // Verify creator belongs to the organization
    const userOrg = await this.prisma.user_organizations.findUnique({
      where: {
        user_id_organization_id: {
          user_id: creator.id,
          organization_id: dto.organization_id,
        },
      },
    });

    if (!userOrg) {
      throw new ForbiddenException('You do not belong to this organization');
    }

    // Non-managers can only assign tasks to themselves
    if (creator.role !== 'manager' && dto.assignee_id !== creator.id) {
      throw new ForbiddenException('You can only assign tasks to yourself');
    }

    const data: any = {
      title: dto.title,
      description: dto.description,
      status: dto.status ?? 'pending',
      due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      repo_id: dto.repo_id || null,
      organization_id: dto.organization_id,
      assignee_id: dto.assignee_id,
    };

    // If creator is manager -> task is already validated
    if (creator.role === 'manager') {
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
    // Managers can view any task, regular users can only view their own
    if (userRole !== 'manager' && task.assignee_id !== userId) {
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
      where: { assignee_id: userId },
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
    return this.prisma.tasks.findMany({
      where: {
        OR: [
          { organization_id: organizationId },
          { repo_id: { in: repoIds } },
        ],
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

