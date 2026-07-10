import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

// JwtAuthGuard must run before RolesGuard: RolesGuard reads request.user, which
// only exists once the JWT strategy has validated the token. Note this guard is
// NOT global (contrary to plan decision D6), so every controller must opt in.
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** GET /api/v1/admin/dashboard?from=&to= — admin only (doc 07 §11.1). */
  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.analytics.getDashboard(query.from, query.to);
  }
}
