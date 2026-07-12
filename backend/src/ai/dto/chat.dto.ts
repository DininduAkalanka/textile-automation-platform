import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content!: string;
}

export class CustomerChatDto {
  /**
   * 500 characters, matching the AI service's own cap. Long inputs are the usual
   * vehicle for prompt-injection payloads, and no genuine shopping question needs
   * more — rejecting them at the edge means they never reach the model or the bill.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;

  /** Bounded so a client cannot inflate the prompt (and the cost) without limit. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
