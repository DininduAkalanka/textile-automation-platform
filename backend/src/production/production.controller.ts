import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignTaskDto, TaskActionDto } from './dto/task-action.dto';
import { ProductionService } from './production.service';

/** JwtStrategy.validate() returns { sub, email, role }. */
interface AuthedRequest {
  user: { sub: string; role: UserRole };
}

/**
 * Production API (doc 07 §10, FR-P1..P5).
 *
 * JwtAuthGuard is applied at the controller because it is NOT global in this
 * project — a route that forgets it would be publicly readable, and this one
 * exposes customer measurements.
 */
@Controller('production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  /** The admin Kanban board, grouped by stage. */
  @Get('pipeline')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getPipeline() {
    return this.production.getPipeline();
  }

  /** Assignable workers (the admin's searchable select). */
  @Get('workers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  getWorkers() {
    return this.production.getWorkers();
  }

  /** A worker's own queue. Admins may call it too, to see their own if linked. */
  @Get('my-tasks')
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN)
  getMyTasks(@Request() req: AuthedRequest) {
    return this.production.getMyTasks(req.user.sub);
  }

  /** BR5: assignment is what makes a task startable. */
  @Put('tasks/:id/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTaskDto) {
    return this.production.assign(id, dto.workerId);
  }

  /**
   * Drive a task through the machine. Workers may act only on their own tasks;
   * that check needs the row, so it lives in the service rather than a guard.
   */
  @Put('tasks/:id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER, UserRole.ADMIN)
  act(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskActionDto,
    @Request() req: AuthedRequest,
  ) {
    return this.production.act(
      id,
      dto.action,
      req.user.sub,
      req.user.role,
      dto.note,
    );
  }
}
