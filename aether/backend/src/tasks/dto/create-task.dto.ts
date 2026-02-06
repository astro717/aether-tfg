import { IsOptional, IsString, IsDateString, IsUUID, IsIn } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  repo_id?: string;

  @IsUUID()
  organization_id!: string;

  @IsUUID()
  assignee_id!: string;

  @IsOptional()
  @IsIn(['pending', 'in_progress', 'done'])
  status?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
