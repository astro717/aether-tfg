import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
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
      const { password_hash, ...result } = user;
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
  }
}
