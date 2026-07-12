import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiService } from './ai.service';
import { CustomerChatDto } from './dto/chat.dto';

interface AuthedRequest {
  user: { sub: string; role: UserRole };
}

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

  /**
   * POST /api/v1/ai/business-chat — the owner's analyst (Session 9.2).
   *
   * ADMIN ONLY. Doc 09 §4.2: "View AI Reports — Admin only". This endpoint can
   * report the shop's revenue and margins, so unlike the customer assistant it is
   * emphatically not public. A customer hitting it gets 403.
   *
   * The role verified here is what gets forwarded to the AI service; the service
   * trusts that header only because the shared internal key proves the caller is
   * this gateway.
   */
  @Post('business-chat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  businessChat(@Body() dto: CustomerChatDto, @Request() req: AuthedRequest) {
    return this.ai.businessChat(dto.message, req.user.role, dto.history ?? []);
  }
}
