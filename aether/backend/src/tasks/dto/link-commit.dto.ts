import { IsString, IsNotEmpty } from 'class-validator';

export class LinkCommitDto {
  @IsString()
  @IsNotEmpty()
  commit_sha!: string;
}
