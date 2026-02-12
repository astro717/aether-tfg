import { Module, forwardRef } from '@nestjs/common';
import { ReposController } from './repos.controller';
import { ReposService } from './repos.service';
import { GithubModule } from '../github/github.module';
import { CommitsModule } from '../commits/commits.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [GithubModule, forwardRef(() => CommitsModule), OrganizationsModule],
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule { }
