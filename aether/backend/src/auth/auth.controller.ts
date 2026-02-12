import { Controller, Post, Get, UseGuards, Body, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { PrismaService } from '../prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('login')
  async login(@Body() body: { email?: string; username?: string; password: string }) {
    if (!body.password) {
      throw new BadRequestException('Password is required');
    }
    const identifier = body.email || body.username;
    if (!identifier) {
      throw new BadRequestException('Email or username is required');
    }
    return this.authService.login(identifier, body.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { username: string; email: string; password: string }) {
    if (!body.username || !body.email || !body.password) {
      throw new BadRequestException('Username, email, and password are required');
    }
    return this.authService.register(body.username, body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    const dbUser = await this.prisma.users.findUnique({
      where: { id: user.id },
      select: { id: true, username: true, email: true, role: true, avatar_color: true },
    });
    return dbUser;
  }

  @UseGuards(JwtAuthGuard)
  @Post('github/connect')
  async connectGithub(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    if (!body.code) {
      throw new BadRequestException('Authorization code is required');
    }
    return this.authService.connectGithub(user.id, body.code);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) {
      throw new BadRequestException('Token and password are required');
    }
    return this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    if (!body.currentPassword || !body.newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('send-reset-email')
  @HttpCode(HttpStatus.OK)
  async sendResetEmailToCurrentUser(@CurrentUser() user: any) {
    return this.authService.sendPasswordResetToCurrentUser(user.id);
  }
}
