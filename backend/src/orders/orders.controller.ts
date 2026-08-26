import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { InvoiceService } from '../invoices/invoice.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { GuestCheckoutDto } from './dto/guest-checkout.dto';
import { OrderActionDto } from './dto/order-action.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import type { RequestWithUser } from '../common/types/request-with-user';

// Mirrors the same constants used in AuthController so guest sessions
// share the same cookie name/lifetime and can silently refresh.
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * F-01 fix: set the refresh token as an httpOnly cookie — identical to the
   * /auth/login and /auth/register contract — and strip it from the JSON
   * response body so it is never accessible to page scripts.
   * Previously the service result was returned verbatim, which exposed
   * the raw refreshToken to any XSS on the page (audit finding F-01).
   *
   * F-07: @Public() allows unauthenticated access — guests have no JWT yet.
   */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('guest-checkout')
  async guestCheckout(
    @Body() dto: GuestCheckoutDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { order, session } = await this.ordersService.guestCheckout(
      dto,
      req.headers['user-agent'],
    );
    // F-01 fix: strip refreshToken from the JSON body and set it as an
    // httpOnly cookie — identical to the /auth/login and /auth/register
    // contract — so the refresh token is never accessible to page scripts.
    const { refreshToken, ...sessionWithoutToken } = session as {
      refreshToken: string;
      [key: string]: unknown;
    };
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    });
    return { order, session: sessionWithoutToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findUserOrders(
    @Request() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findUserOrders(req.user.sub, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findById(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    return this.ordersService.findById(
      id,
      isAdmin ? { isAdmin: true } : { userId: req.user.sub },
    );
  }

  /** Download the order's PDF invoice — the same document emailed on
   *  confirmation. findById() enforces ownership (throws 403/404) before we
   *  render, so a customer can only fetch their own. Streams the raw PDF via
   *  @Res(), bypassing the JSON response envelope. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/invoice.pdf')
  async invoice(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const isAdmin = req.user.role === UserRole.ADMIN;
    await this.ordersService.findById(
      id,
      isAdmin ? { isAdmin: true } : { userId: req.user.sub },
    );

    const pdf = await this.invoiceService.generateForOrder(id);
    if (!pdf) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    res.send(pdf.buffer);
  }

  /** Customer self-service: cancel their own order. The service enforces that
   *  this only works while it is still PENDING — anything past that is an
   *  admin's judgment call, through the action route below. */
  @UseGuards(JwtAuthGuard)
  @Put(':id/cancel')
  cancelMine(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note?: string,
  ) {
    return this.ordersService.cancel(
      id,
      { id: req.user.sub, role: req.user.role },
      { note },
    );
  }

  // ─── Admin Endpoints ───────────────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllOrders(@Query() query: AdminOrdersQueryDto) {
    return this.ordersService.findAllOrders(query);
  }

  /** One route for all three graph-driven verbs (plan 7.1 task 2) — the
   *  action name picks which OrdersService method runs; "confirm" and
   *  "mark_collected" are NOT here, they are payments.service.ts's
   *  markPaymentPaid under two labels (see AdminOrderAction's docblock). */
  @Put('admin/:id/action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  action(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderActionDto,
  ) {
    const actor = { id: req.user.sub, role: UserRole.ADMIN };
    switch (dto.action) {
      case 'cancel':
        return this.ordersService.cancel(id, actor, {
          note: dto.note,
          acknowledgeRefund: dto.acknowledgeRefund,
        });
      case 'advance':
        return this.ordersService.advance(id, req.user.sub, dto.note);
      case 'deliver':
        return this.ordersService.deliver(id, req.user.sub, dto.note);
    }
  }
}
