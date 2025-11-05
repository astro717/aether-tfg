import { IsOptional, IsString, IsDateString, IsUUID, IsIn } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // opcional: si permites asignar a otro usuario o repo
  @IsOptional()
  @IsUUID()
  repo_id?: string;

  @IsOptional()
  @IsIn(['pending', 'in_progress', 'done'])
  status?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;
}
