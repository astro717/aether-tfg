import { Controller, Get, Param, Delete, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }


  // GET /users
  @Get()
  @Roles('manager')
  findAll() {
    return this.usersService.findAll();
  }

  // GET /users/me/settings - Get current user's notification settings
  @Get('me/settings')
  getMySettings(@Request() req: AuthenticatedRequest) {
    return this.usersService.getNotificationSettings(req.user.id);
  }

  // PATCH /users/me/settings - Update current user's notification settings
  @Patch('me/settings')
  updateMySettings(@Request() req: AuthenticatedRequest, @Body() dto: UpdateNotificationSettingsDto) {
    return this.usersService.updateNotificationSettings(req.user.id, dto);
  }

  // PATCH /users/me/profile - Update current user's profile
  @Patch('me/profile')
  updateMyProfile(@Request() req: AuthenticatedRequest, @Body() dto: any) { // Type as UpdateUserProfileDto in real app
    return this.usersService.updateProfile(req.user.id, dto);
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
