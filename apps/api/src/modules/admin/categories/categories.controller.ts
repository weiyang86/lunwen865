import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CategoryReorderDto } from './dto/category-reorder.dto';
import { CategoryUpsertDto } from './dto/category-upsert.dto';
import { CategoriesService } from './categories.service';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get('tree')
  tree(): Promise<unknown> {
    return this.service.tree();
  }

  @Post()
  create(@Body() dto: CategoryUpsertDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CategoryUpsertDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('reorder')
  reorder(@Body() dto: CategoryReorderDto) {
    return this.service.reorder(dto);
  }
}
