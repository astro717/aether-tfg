import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
      const user = await this.prisma.users.create({
        data: {
          username,
          email,
          password_hash: hashed,
          role: 'user',
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
}
