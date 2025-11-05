import { Controller, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  // GET /users
  @Get()
  @Roles('manager')
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/:id
  @Get(':id')
  @Roles('manager')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  //DELETE users/:id
  @Delete(':id')
  @Roles('manager')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
