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
      select: { id: true, username: true, email: true, role: true },
    });
    return dbUser;
  }
}
