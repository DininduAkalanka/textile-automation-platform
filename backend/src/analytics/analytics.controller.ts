import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AiService } from '../ai/ai.service';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

interface AuthedRequest {
  user: { sub: string; role: UserRole };
}

const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

// JwtAuthGuard must run before RolesGuard: RolesGuard reads request.user, which
// only exists once the JWT strategy has validated the token. Note this guard is
// NOT global (contrary to plan decision D6), so every controller must opt in.
@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly ai: AiService,
  ) {}

  /** GET /api/v1/admin/dashboard?from=&to= — admin only (doc 07 §11.1). */
  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.analytics.getDashboard(query.from, query.to);
  }

  // ─── Predictive analytics (proxied to the AI service) ─────────────────────
  // The AI service holds the ML models; these forward to it and never 500 — the
  // proxy returns { unavailable: true } if the service is cold or down.

  @Get('analytics/forecast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  forecast(@Req() req: AuthedRequest) {
    return this.ai.getForecast(req.user.role);
  }

  @Get('analytics/trending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  trending(@Req() req: AuthedRequest) {
    return this.ai.getTrending(req.user.role);
  }

  @Get('analytics/dead-stock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deadStock(@Req() req: AuthedRequest) {
    return this.ai.getDeadStock(req.user.role);
  }

  @Get('analytics/recommendations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  recommendations(@Req() req: AuthedRequest) {
    return this.ai.getRecommendations(req.user.role);
  }

  @Get('analytics/reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  reorder(@Req() req: AuthedRequest) {
    return this.ai.getReorder(req.user.role);
  }

  @Get('analytics/top-products')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  topProducts(
    @Req() req: AuthedRequest,
    @Query('period') period?: string,
    @Query('by') by?: string,
  ) {
    return this.ai.getTopProducts(req.user.role, period, by);
  }

  // ─── CSV reports (plan Session 8.1 task 2) ────────────────────────────────

  @Get('reports/sales.csv')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async salesCsv(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthedRequest,
    // Plain @Res (not passthrough): we send the file ourselves, bypassing the
    // global JSON envelope interceptor that would otherwise corrupt the CSV.
    @Res() res: Response,
  ): Promise<void> {
    const range = this.analytics.resolveRange(query.from, query.to);
    const rows = await this.analytics.salesReport(range);
    await this.analytics.recordExport(req.user.sub, 'sales', {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });

    const csv = this.analytics.toCsv(
      ['Product', 'Type', 'Quantity Sold', 'Revenue (LKR)'],
      rows.map((r) => [r.name, r.type, r.quantity, r.revenue]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-${isoDay(range.from)}_to_${isoDay(range.to)}.csv"`,
    );
    res.send(csv);
  }

  @Get('reports/inventory.csv')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async inventoryCsv(
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.analytics.inventoryReport();
    await this.analytics.recordExport(req.user.sub, 'inventory', {
      at: new Date().toISOString(),
    });

    const csv = this.analytics.toCsv(
      ['Product', 'Type', 'Available', 'Reserved', 'Sellable', 'Minimum', 'Low Stock'],
      rows.map((r) => [
        r.name,
        r.type,
        r.available,
        r.reserved,
        r.sellable,
        r.minimum,
        r.low ? 'YES' : '',
      ]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventory-${isoDay(new Date())}.csv"`,
    );
    res.send(csv);
  }
}
