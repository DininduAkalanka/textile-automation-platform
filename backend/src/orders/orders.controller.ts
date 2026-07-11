import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, OrderStatus } from '@prisma/client';

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
    // Admin can see any order, customer can only see their own
    const userId = req.user.role === UserRole.ADMIN ? undefined : req.user.sub;
    return this.ordersService.findById(id, userId);
  }

  // ─── Admin Endpoints ───────────────────────────────────

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findAllOrders(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.findAllOrders(page, limit, status);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status, req.user.sub);
  }
}
