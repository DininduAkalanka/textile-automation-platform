import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { TaskAction } from '../production.machine';

const ACTIONS: TaskAction[] = [
  'start',
  'complete',
  'advance',
  'qc_pass',
  'qc_fail',
];

export class TaskActionDto {
  @IsIn(ACTIONS, {
    message: `action must be one of: ${ACTIONS.join(', ')}`,
  })
  action!: TaskAction;

  /** Mandatory for qc_fail — enforced in the service, which knows the state. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignTaskDto {
  @IsUUID()
  workerId!: string;
}
