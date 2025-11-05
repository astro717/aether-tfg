import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { ReposService } from './repos.service';
import { CreateRepoDto } from './dto/create-repo.dto';
import { UpdateRepoDto } from './dto/update-repo.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UseGuards } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { users } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('repos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReposController {
  constructor(private readonly reposService: ReposService) {}

  @Post()
  @Roles('manager')
  create(@Body() dto: CreateRepoDto, @CurrentUser() user: users) {
    return this.reposService.create(dto, user);
  }

  @Get()
  findAll() {
    return this.reposService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reposService.findOne(id);
  }

  @Patch(':id')
  @Roles('manager')
  update(@Param('id') id: string, @Body() dto: UpdateRepoDto, @CurrentUser() user: users) {
    return this.reposService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') id: string, @CurrentUser() user: users) {
    return this.reposService.remove(id, user);
  }
}
