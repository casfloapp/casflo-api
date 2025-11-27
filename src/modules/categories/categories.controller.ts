import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../util/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Req() req: any, @Body('name') name: string) {
    return this.categoriesService.create(req.user.userId, name);
  }

  @Get()
  async findAll(@Req() req: any) {
    return this.categoriesService.findAll(req.user.userId);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.categoriesService.update(id, req.user.userId, name);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.categoriesService.remove(id, req.user.userId);
  }
}
