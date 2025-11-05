import { IsString, IsUUID, IsOptional, IsInt } from 'class-validator';

export class CreateCommitDto {
  @IsString()
  sha!: string;

  @IsUUID()
  repo_id!: string;

  @IsString()
  message!: string;

  @IsOptional()
  committed_at?: Date;

  @IsOptional()
  @IsInt()
  added_lines?: number;

  @IsOptional()
  @IsInt()
  deleted_lines?: number;
}
