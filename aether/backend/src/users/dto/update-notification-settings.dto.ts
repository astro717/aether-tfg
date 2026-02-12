import { IsBoolean, IsOptional, IsArray, IsInt, Min, Max, ArrayMaxSize } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  notify_email_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_email_assignments?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_email_comments?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_email_mentions?: boolean;

  @IsOptional()
  @IsBoolean()
  notify_inapp_enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(168, { each: true }) // Max 1 week in hours
  @ArrayMaxSize(5) // Max 5 reminder times
  deadline_reminder_hours?: number[];
}
