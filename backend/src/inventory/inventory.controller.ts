import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  InventoryQueryDto,
  MovementsQueryDto,
  SetMinimumDto,
} from './dto/inventory-query.dto';
import { InventoryService } from './inventory.service';

/**
 * Stock control. Every route here is ADMIN-only and every route is a write worth
 * auditing, so the guards are applied at the class level rather than per-method:
 * a future route added to this controller is protected by default, not by whether
 * whoever added it remembered to. (JwtAuthGuard must precede RolesGuard — the
 * latter reads request.user, which only exists after the JWT is validated.)
 *
 * MANAGER is deliberately NOT granted access. The role exists in the enum but no
 * endpoint anywhere in the system grants it anything today, and inventing a policy
 * here that nothing else honours would be worse than the gap it fills.
 */
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  /** GET /api/v1/inventory?page=&limit=&search=&categoryId=&lowStockOnly= */
  @Get()
  list(@Query() query: InventoryQueryDto) {
    return this.inventory.list(query);
  }

  /**
   * GET /api/v1/inventory/low-stock
   *
   * MUST be declared before ':productId/...' routes. Nest matches in declaration
   * order, and a literal segment placed after a parameterised one is unreachable —
   * a classic way to ship a 404 that only appears in production.
   */
  @Get('low-stock')
  lowStock() {
    return this.inventory.lowStock();
  }

  /** GET /api/v1/inventory/:productId/movements — the audit ledger. */
  @Get(':productId/movements')
  movements(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: MovementsQueryDto,
  ) {
    return this.inventory.movements(
      productId,
      query.page ?? 1,
      query.limit ?? 25,
    );
  }

  /**
   * PUT /api/v1/inventory/:productId/adjust
   *
   * The admin's identity comes from the VALIDATED JWT, never from the body. If the
   * client could name the author of an audit log, the audit log would be fiction.
   */
  @Put(':productId/adjust')
  adjust(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: AdjustStockDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.inventory.adjust(
      productId,
      dto.change,
      dto.type,
      req.user.sub,
      dto.note,
    );
  }

  /** PUT /api/v1/inventory/:productId/minimum — the reorder threshold. */
  @Put(':productId/minimum')
  setMinimum(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SetMinimumDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.inventory.setMinimum(productId, dto.minimum, req.user.sub);
  }
}
