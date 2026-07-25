import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ShareDto } from './dto/share.dto';
import { SocialService } from './social.service';

/**
 * Admin-only social sharing for a product. Mounted under the same /admin prefix
 * as the analytics controller; JwtAuthGuard runs first (populates request.user)
 * so RolesGuard can enforce ADMIN.
 */
@Controller('admin/products/:id/social')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  /** The generated caption + WhatsApp link + which platforms are connected. */
  @Get('preview')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.social.preview(id);
  }

  /** Attempt to post to the chosen platforms (never throws per-platform). */
  @Post('post')
  post(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ShareDto) {
    return this.social.post(id, dto.platforms);
  }
}
