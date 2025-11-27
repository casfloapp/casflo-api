import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, month?: string) {
    const where: any = { userId };
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const from = new Date(year, m - 1, 1);
      const to = new Date(year, m, 0, 23, 59, 59);
      where.createdAt = { gte: from, lte: to };
    }
    const tx = await this.prisma.transaction.findMany({ where });
    const income = tx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = tx.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    return { income, expense, balance: income - expense };
  }

  async byCategory(userId: string) {
    const tx = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId },
      _sum: { amount: true },
    });

    return tx;
  }
}
