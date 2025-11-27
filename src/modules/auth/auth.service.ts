import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) return null;
    // omit password
    const { password, ...result } = user;
    return result;
  }

  async login(userId: string) {
    const payload = { sub: userId };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
      },
    });

    return { accessToken, refreshToken };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
    });
    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    const payload = await this.jwtService.verifyAsync(token).catch(() => {
      throw new UnauthorizedException('Invalid refresh token');
    });

    return this.login(payload.sub);
  }

  async revoke(token: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
    return { success: true };
  }

  async register(email: string, password: string, name?: string) {
    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email,
      password: hash,
      name,
    });
    return this.login(user.id);
  }
}
