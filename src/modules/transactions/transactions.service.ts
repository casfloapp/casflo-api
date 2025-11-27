import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateTxInput {
  amount: number;
  type: string;
  categoryId?: string;
  note?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateTxInput) {
    return this.prisma.transaction.create({
      data: {
        userId,
        amount: data.amount,
        type: data.type,
        categoryId: data.categoryId,
        note: data.note,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    return this.prisma.transaction.findFirst({
      where: { id, userId },
    });
  }

  async update(id: string, userId: string, data: Partial<CreateTxInput>) {
    return this.prisma.transaction.updateMany({
      where: { id, userId },
      data,
    });
  }

  async remove(id: string, userId: string) {
    return this.prisma.transaction.deleteMany({
      where: { id, userId },
    });
  }
}
