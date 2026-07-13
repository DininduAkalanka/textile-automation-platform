import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderActionDto } from './dto/order-action.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.sub, dto);
  }

  @Get()
  findUserOrders(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findUserOrders(req.user.sub, page, limit);
  }

  @Get(':id')
  findById(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const isAdmin = req.user.role === UserRole.ADMIN;
    return this.ordersService.findById(
      id,
      isAdmin ? { isAdmin: true } : { userId: req.user.sub },
    );
  }

  /** Customer self-service: cancel their own order. The service enforces that
   *  this only works while it is still PENDING — anything past that is an
   *  admin's judgment call, through the action route below. */
  @Put(':id/cancel')
  cancelMine(
    @Request() req: any,
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllOrders(@Query() query: AdminOrdersQueryDto) {
    return this.ordersService.findAllOrders(query);
  }

  /** One route for all three graph-driven verbs (plan 7.1 task 2) — the
   *  action name picks which OrdersService method runs; "confirm" and
   *  "mark_collected" are NOT here, they are payments.service.ts's
   *  markPaymentPaid under two labels (see AdminOrderAction's docblock). */
  @Put('admin/:id/action')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  action(
    @Request() req: any,
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
