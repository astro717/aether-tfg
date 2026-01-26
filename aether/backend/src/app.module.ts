import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { ReposModule } from './repos/repos.module';
import { CommitsModule } from './commits/commits.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, TasksModule, ReposModule, CommitsModule, OrganizationsModule],
})
export class AppModule {}
