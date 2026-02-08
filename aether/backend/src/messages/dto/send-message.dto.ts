import { IsNotEmpty, IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @IsString()
  filePath!: string;

  @IsString()
  fileName!: string;

  @IsNumber()
  fileSize!: number;

  @IsString()
  fileType!: string;

  @IsString()
  fileUrl!: string;
}

export class SendMessageDto {
  @IsUUID()
  @IsNotEmpty()
  receiverId!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
