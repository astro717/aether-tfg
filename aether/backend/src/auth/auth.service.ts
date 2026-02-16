import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) { }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw new UnauthorizedException('Invalid password');

    // devolvemos user sin password
    const { password_hash, ...result } = user;
    return result;
  }

  async login(identifier: string, password: string) {
    // Support login by email or username
    const isEmail = identifier.includes('@');
    const user = isEmail
      ? await this.prisma.users.findUnique({ where: { email: identifier } })
      : await this.prisma.users.findUnique({ where: { username: identifier } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }


  async register(username: string, email: string, password: string) {
    const hashed = await bcrypt.hash(password, 10);
    try {
      // Smart color assignment: avoid repetition within same initial
      const avatarColor = await this.selectSmartAvatarColor(username);

      const user = await this.prisma.users.create({
        data: {
          username,
          email,
          password_hash: hashed,
          role: 'user',
          avatar_color: avatarColor,
        },
      });

      // Generate JWT token for immediate login after registration
      const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }

  /**
   * Smart avatar color selection
   * Queries users with the same initial and tries to pick an unused color
   */
  private async selectSmartAvatarColor(username: string): Promise<string> {
    const AVATAR_COLORS = [
      'blue', 'purple', 'green', 'orange', 'pink',
      'teal', 'indigo', 'rose', 'amber', 'cyan'
    ];

    // Get the first letter of username (case-insensitive)
    const initial = username.charAt(0).toUpperCase();

    // Find all users with the same initial
    const usersWithSameInitial = await this.prisma.users.findMany({
      where: {
        username: {
          startsWith: initial,
          mode: 'insensitive',
        },
      },
      select: {
        avatar_color: true,
      },
    });

    // Collect colors already in use for this initial
    const usedColors = new Set(
      usersWithSameInitial
        .map(u => u.avatar_color)
        .filter(c => c && c !== 'zinc')
    );

    // Find available colors (not yet used by this initial group)
    const availableColors = AVATAR_COLORS.filter(c => !usedColors.has(c));

    // If there are available colors, pick one randomly
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }

    // If all colors are used, just pick any random color
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  }

  async connectGithub(userId: string, code: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new BadRequestException(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const { access_token, refresh_token } = tokenData;

    if (!access_token) {
      throw new BadRequestException('Failed to obtain access token from GitHub');
    }

    // Fetch GitHub user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      throw new BadRequestException('Failed to fetch GitHub user profile');
    }

    const githubUser = await userResponse.json();

    // Update user record with GitHub data
    const updatedUser = await this.prisma.users.update({
      where: { id: userId },
      data: {
        github_id: String(githubUser.id),
        github_login: githubUser.login,
        github_access_token: access_token,
        github_refresh_token: refresh_token || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        github_id: true,
        github_login: true,
      },
    });

    return {
      success: true,
      user: updatedUser,
      github_login: githubUser.login,
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.users.findUnique({ where: { email } });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return { message: 'If an account exists with this email, you will receive a password reset link.' };
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Save hashed token to database
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        reset_password_token: hashedToken,
        reset_password_expires: expiresAt,
      },
    });

    // Build reset URL with raw token (not hashed)
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send email
    await this.emailService.sendPasswordResetEmail(user.email, resetLink, user.username);

    return { message: 'If an account exists with this email, you will receive a password reset link.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.users.findFirst({
      where: {
        reset_password_token: hashedToken,
        reset_password_expires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Hash the new password and clear the reset token
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: hashedPassword,
        reset_password_token: null,
        reset_password_expires: null,
      },
    });

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(user.email, user.username);

    return { message: 'Password has been reset successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters long');
    }

    // Ensure new password is different from current
    const isSame = await bcrypt.compare(newPassword, user.password_hash);
    if (isSame) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.users.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(user.email, user.username);

    return { message: 'Password changed successfully' };
  }

  async sendPasswordResetToCurrentUser(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.forgotPassword(user.email);
  }
}
