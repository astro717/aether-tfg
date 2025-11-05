import { IsString, IsOptional, IsInt } from 'class-validator';

export class UpdateCommitDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsInt()
  added_lines?: number;

  @IsOptional()
  @IsInt()
  deleted_lines?: number;
}
