export class CreateNotificationDto {
  user_id!: string;
  actor_id?: string;
  type!: 'TASK_ASSIGNED' | 'TASK_COMMENT' | 'TASK_DEADLINE' | 'TASK_VALIDATED' | 'TASK_REJECTED' | 'MENTION' | 'MESSAGE';
  title!: string;
  content?: string;
  entity_id?: string;
  entity_type?: 'task' | 'message';
}
