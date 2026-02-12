import { Module } from '@nestjs/common';
import { CommitsController } from './commits.controller';
import { CommitsService } from './commits.service';
import { GithubModule } from '../github/github.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [GithubModule, OrganizationsModule],
  controllers: [CommitsController],
  providers: [CommitsService],
  exports: [CommitsService],
})
export class CommitsModule { }
