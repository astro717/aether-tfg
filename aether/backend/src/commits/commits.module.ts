import { Module } from '@nestjs/common';
import { CommitsController } from './commits.controller';
import { CommitsService } from './commits.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule],
  controllers: [CommitsController],
  providers: [CommitsService],
  exports: [CommitsService],
})
export class CommitsModule {}
