import { IsString, IsOptional, IsUrl } from 'class-validator';

export class UpdateRepoDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
