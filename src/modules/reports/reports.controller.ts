import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../util/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  async summary(@Req() req: any, @Query('month') month?: string) {
    return this.reportsService.summary(req.user.userId, month);
  }

  @Get('category')
  async byCategory(@Req() req: any) {
    return this.reportsService.byCategory(req.user.userId);
  }
}
