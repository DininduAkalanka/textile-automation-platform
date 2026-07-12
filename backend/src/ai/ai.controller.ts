import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AiService } from './ai.service';
import { CustomerChatDto } from './dto/chat.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /**
   * POST /api/v1/ai/customer-chat
   *
   * Public by design — a guest browsing the shop is exactly who this is for, and
   * requiring a login to ask "do you have cotton?" would defeat the point.
   *
   * Which makes the rate limit the only thing standing between an anonymous
   * caller and the LLM bill: 10 requests/minute/IP (plan Session 9.1, task 5).
   * The default throttle is 100/min, which would be generous enough to be
   * expensive.
   */
  @Post('customer-chat')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  customerChat(@Body() dto: CustomerChatDto) {
    return this.ai.customerChat(dto.message, dto.history ?? []);
  }
}
