import { Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get('my-organizations')
  async getMyOrganizations(@CurrentUser() user: any) {
    return this.organizationsService.findUserOrganizations(user.userId);
  }

  @Get(':id')
  async getOrganization(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: any,
  ) {
    return this.organizationsService.findOne(id, user.userId);
  }

  @Post(':id/members')
  async addMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { userId: string },
  ) {
    return this.organizationsService.addUser(id, body.userId);
  }

  @Post()
  async createOrganization(
    @Body() createDto: { name: string },
    @CurrentUser() user: any,
  ) {
    return this.organizationsService.create(createDto.name, user.userId);
  }
}
