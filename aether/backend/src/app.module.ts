import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma.module';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { ReposModule } from './repos/repos.module';
import { CommitsModule } from './commits/commits.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MessagesModule } from './messages/messages.module';
import { GithubModule } from './github/github.module';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';
import configuration, { configurationSchema } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configurationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    TasksModule,
    ReposModule,
    CommitsModule,
    OrganizationsModule,
    MessagesModule,
    GithubModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
