import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserInput) {
    return this.prisma.user.create({ data });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateProfile(id: string, data: Partial<CreateUserInput>) {
    return this.prisma.user.update({
      where: { id },
      data: {
        email: data.email,
        name: data.name,
      },
    });
  }
}
