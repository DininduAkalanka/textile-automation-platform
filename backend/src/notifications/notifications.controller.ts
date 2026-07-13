import {
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

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

/** JwtStrategy.validate() returns { sub, email, role }. */
interface AuthedRequest {
  user: { sub: string; role: UserRole };
}

/**
 * The bell, for both navbars (plan Session 7.1, task 4). No RolesGuard: every
 * signed-in user — customer, worker, admin — reads their OWN notifications, and
 * "own" is enforced inside the service by scoping every query to req.user.sub,
 * never to an id the client supplies.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Request() req: AuthedRequest,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notifications.list(req.user.sub, page, limit);
  }

  @Put('read-all')
  markAllRead(@Request() req: AuthedRequest) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Put(':id/read')
  markRead(
    @Request() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(id, req.user.sub);
  }
}
