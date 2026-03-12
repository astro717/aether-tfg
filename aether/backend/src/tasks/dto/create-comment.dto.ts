import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CommentAttachmentDto {
  @IsString() file_path!: string;
  @IsString() file_url!: string;
  @IsString() file_name!: string;
  @IsNotEmpty() file_size!: number;
  @IsString() file_type!: string;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommentAttachmentDto)
  attachments?: CommentAttachmentDto[];
}
