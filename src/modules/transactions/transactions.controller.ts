import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../util/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.transactionsService.create(req.user.userId, body);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.transactionsService.findAll(req.user.userId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.transactionsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.transactionsService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.transactionsService.remove(id, req.user.userId);
  }
}
