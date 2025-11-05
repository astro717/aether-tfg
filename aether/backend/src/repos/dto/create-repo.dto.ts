import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateRepoDto {
  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  organization_id?: string;
}
