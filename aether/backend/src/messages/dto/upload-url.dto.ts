import { IsNotEmpty, IsString } from 'class-validator';

export class UploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  filePath: string;
  token: string;
}
