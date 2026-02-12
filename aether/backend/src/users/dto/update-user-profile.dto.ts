import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateUserProfileDto {
    @IsOptional()
    @IsString()
    display_name?: string;

    @IsOptional()
    @IsString()
    job_title?: string;

    @IsOptional()
    @IsString()
    bio?: string;

    @IsOptional()
    @IsString()
    avatar_color?: string;
}
