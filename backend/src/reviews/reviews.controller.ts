import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReviewStatus, UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ─── Public ──────────────────────────────────────────────

  @Get('product/:productId')
  findForProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findForProduct(productId, query);
  }

  // ─── Customer ────────────────────────────────────────────

  @Get('eligibility/:productId')
  @UseGuards(JwtAuthGuard)
  checkEligibility(
    @Request() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.reviewsService.checkEligibility(req.user.sub, productId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(req.user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(id, req.user.sub, dto);
  }

  @Post(':id/helpful')
  @UseGuards(JwtAuthGuard)
  toggleHelpful(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.toggleHelpful(id, req.user.sub);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  report(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviewsService.report(id, req.user.sub, dto);
  }

  // ─── Admin moderation ────────────────────────────────────
  // 'admin/all' and 'admin/reported' are two path segments, so neither can
  // ever be shadowed by the single-segment ':id' routes above regardless of
  // declaration order (same reasoning as ProductsController).

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminFindAll(
    @Query('status') status?: ReviewStatus,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.adminFindAll({ status, productId, search, page, limit });
  }

  @Get('admin/reported')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminFindReported(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.reviewsService.adminFindAll({ reportedOnly: true, page, limit });
  }

  @Patch('admin/:id/hide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminHide(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.hide(id);
  }

  @Patch('admin/:id/unhide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminUnhide(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.unhide(id);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminRemove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.remove(id);
  }
}
