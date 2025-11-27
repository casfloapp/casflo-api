import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string) {
    return this.prisma.category.create({
      data: { name, userId },
    });
  }

  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, userId: string, name: string) {
    return this.prisma.category.updateMany({
      where: { id, userId },
      data: { name },
    });
  }

  async remove(id: string, userId: string) {
    return this.prisma.category.deleteMany({
      where: { id, userId },
    });
  }
}
