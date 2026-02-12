import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    this.fromAddress = this.configService.get<string>('SMTP_FROM', 'noreply@aether.app');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('SMTP transporter configured successfully');
    } else {
      this.logger.warn('SMTP credentials not configured. Emails will be logged to console.');
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    if (!this.transporter) {
      this.logger.log('--- EMAIL MOCK ---');
      this.logger.log(`To: ${to}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Body: ${text || html}`);
      this.logger.log('--- END EMAIL ---');
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
      });
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string, username: string): Promise<boolean> {
    const subject = 'Reset Your Password - Aether';
    const html = this.getPasswordResetTemplate(resetLink, username);
    return this.sendEmail({ to, subject, html });
  }

  async sendPasswordChangedEmail(to: string, username: string): Promise<boolean> {
    const subject = 'Password Changed Successfully - Aether';
    const html = this.getPasswordChangedTemplate(username);
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Send task assignment notification email
   */
  async sendTaskAssignedEmail(
    to: string,
    recipientName: string,
    taskTitle: string,
    assignedBy: string,
    taskLink: string,
  ): Promise<boolean> {
    const subject = `New Task Assigned: ${taskTitle} - Aether`;
    const html = this.getTaskAssignedTemplate(recipientName, taskTitle, assignedBy, taskLink);
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Send task comment notification email
   */
  async sendTaskCommentEmail(
    to: string,
    recipientName: string,
    taskTitle: string,
    commenterName: string,
    commentContent: string,
    taskLink: string,
  ): Promise<boolean> {
    const subject = `New Comment on "${taskTitle}" - Aether`;
    const html = this.getTaskCommentTemplate(recipientName, taskTitle, commenterName, commentContent, taskLink);
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Send mention notification email
   */
  async sendMentionEmail(
    to: string,
    recipientName: string,
    mentionedBy: string,
    taskTitle: string,
    context: string,
    taskLink: string,
  ): Promise<boolean> {
    const subject = `${mentionedBy} mentioned you in "${taskTitle}" - Aether`;
    const html = this.getMentionTemplate(recipientName, mentionedBy, taskTitle, context, taskLink);
    return this.sendEmail({ to, subject, html });
  }

  /**
   * Send deadline reminder email
   */
  async sendDeadlineReminderEmail(
    to: string,
    recipientName: string,
    taskTitle: string,
    dueDate: Date,
    isOverdue: boolean,
    taskLink: string,
  ): Promise<boolean> {
    const subject = isOverdue
      ? `Task Overdue: ${taskTitle} - Aether`
      : `Deadline Approaching: ${taskTitle} - Aether`;
    const html = this.getDeadlineReminderTemplate(recipientName, taskTitle, dueDate, isOverdue, taskLink);
    return this.sendEmail({ to, subject, html });
  }

  private getPasswordResetTemplate(resetLink: string, username: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">Reset Your Password</h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${username},<br><br>
                We received a request to reset your password. Click the button below to create a new password. This link will expire in 1 hour.
              </p>

              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px; letter-spacing: 0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #71717a;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                This link expires in 1 hour. If you need help, contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getPasswordChangedTemplate(username: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; background-color: #dcfce7; border-radius: 50%; line-height: 56px; text-align: center;">
                  <span style="font-size: 28px;">&#10003;</span>
                </div>
              </div>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b; text-align: center;">Password Changed Successfully</h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b; text-align: center;">
                Hi ${username},<br><br>
                Your password has been changed successfully. If you made this change, no further action is needed.
              </p>

              <div style="padding: 16px; background-color: #fef3c7; border-radius: 10px; margin-top: 24px;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #92400e;">
                  <strong>Didn't make this change?</strong><br>
                  If you didn't change your password, your account may have been compromised. Please reset your password immediately and contact support.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                This is an automated security notification from Aether.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private getTaskAssignedTemplate(
    recipientName: string,
    taskTitle: string,
    assignedBy: string,
    taskLink: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Assigned</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; background-color: #dbeafe; border-radius: 50%; line-height: 56px; text-align: center;">
                  <span style="font-size: 28px;">📋</span>
                </div>
              </div>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b; text-align: center;">New Task Assigned</h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${recipientName},<br><br>
                <strong>${assignedBy}</strong> has assigned you a new task:
              </p>
              <div style="padding: 16px; background-color: #f4f4f5; border-radius: 10px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #18181b;">${taskTitle}</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                You can manage your email preferences in Settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getTaskCommentTemplate(
    recipientName: string,
    taskTitle: string,
    commenterName: string,
    commentContent: string,
    taskLink: string,
  ): string {
    // Truncate comment if too long
    const truncatedComment = commentContent.length > 200
      ? commentContent.substring(0, 200) + '...'
      : commentContent;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; background-color: #e0e7ff; border-radius: 50%; line-height: 56px; text-align: center;">
                  <span style="font-size: 28px;">💬</span>
                </div>
              </div>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b; text-align: center;">New Comment</h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${recipientName},<br><br>
                <strong>${commenterName}</strong> commented on <strong>"${taskTitle}"</strong>:
              </p>
              <div style="padding: 16px; background-color: #f4f4f5; border-radius: 10px; border-left: 4px solid #6366f1; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #52525b; font-style: italic;">"${truncatedComment}"</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px;">
                      View Comment
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                You can manage your email preferences in Settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getMentionTemplate(
    recipientName: string,
    mentionedBy: string,
    taskTitle: string,
    context: string,
    taskLink: string,
  ): string {
    const truncatedContext = context.length > 200
      ? context.substring(0, 200) + '...'
      : context;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You Were Mentioned</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; background-color: #fef3c7; border-radius: 50%; line-height: 56px; text-align: center;">
                  <span style="font-size: 28px;">@</span>
                </div>
              </div>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b; text-align: center;">You Were Mentioned</h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${recipientName},<br><br>
                <strong>${mentionedBy}</strong> mentioned you in <strong>"${taskTitle}"</strong>:
              </p>
              <div style="padding: 16px; background-color: #fef3c7; border-radius: 10px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #78350f;">"${truncatedContext}"</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                You can manage your email preferences in Settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  private getDeadlineReminderTemplate(
    recipientName: string,
    taskTitle: string,
    dueDate: Date,
    isOverdue: boolean,
    taskLink: string,
  ): string {
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const headerBgColor = isOverdue ? '#fef2f2' : '#fef3c7';
    const headerIcon = isOverdue ? '⚠️' : '⏰';
    const headerTitle = isOverdue ? 'Task Overdue' : 'Deadline Approaching';
    const headerTextColor = isOverdue ? '#991b1b' : '#92400e';
    const borderColor = isOverdue ? '#ef4444' : '#f59e0b';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 300; color: #18181b; letter-spacing: 2px;">aether.</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 56px; height: 56px; background-color: ${headerBgColor}; border-radius: 50%; line-height: 56px; text-align: center;">
                  <span style="font-size: 28px;">${headerIcon}</span>
                </div>
              </div>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: ${headerTextColor}; text-align: center;">${headerTitle}</h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hi ${recipientName},<br><br>
                ${isOverdue
                  ? 'The following task has passed its deadline:'
                  : 'The following task is approaching its deadline:'}
              </p>
              <div style="padding: 16px; background-color: ${headerBgColor}; border-radius: 10px; border-left: 4px solid ${borderColor}; margin-bottom: 16px;">
                <p style="margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #18181b;">${taskTitle}</p>
                <p style="margin: 0; font-size: 14px; color: ${headerTextColor};">
                  <strong>Due:</strong> ${formattedDate}
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0;">
                    <a href="${taskLink}" style="display: inline-block; padding: 14px 32px; background-color: ${isOverdue ? '#ef4444' : '#18181b'}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 10px;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #f4f4f5;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                You can customize deadline reminders in Settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
