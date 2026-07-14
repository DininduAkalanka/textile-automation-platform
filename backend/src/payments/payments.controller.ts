import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateFullPaymentDto } from './dto/create-payment.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Stripe Config ──────────────────────────────────────

  @Get('config')
  getStripeConfig() {
    return this.paymentsService.getStripeConfig();
  }

  // ─── PayHere ─────────────────────────────────────────────

  @Post('payhere/create')
  @UseGuards(JwtAuthGuard)
  createPayhere(@Request() req: any, @Body() dto: CreateFullPaymentDto) {
    return this.paymentsService.createPayherePayment(dto.orderId, req.user.sub);
  }

  // ─── Cash on Delivery ────────────────────────────────────

  @Post('cod')
  @UseGuards(JwtAuthGuard)
  createCod(@Request() req: any, @Body() dto: CreateFullPaymentDto) {
    return this.paymentsService.createCodPayment(dto.orderId, req.user.sub);
  }

  // ─── Admin Payment Management ───────────────────────────

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAllPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('method') method?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentsService.getAllPayments(page, limit, { method, status });
  }

  @Post('admin/:orderId/mark-paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  markPaid(
    @Request() req: any,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.paymentsService.markPaymentPaid(
      orderId,
      req.user.sub,
      dto.note,
    );
  }

  @Post('admin/:orderId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  rejectPayment(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.rejectPayment(orderId);
  }

  // ─── Get Payment by Order ──────────────────────────────

  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  getPayment(
    @Request() req: any,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.getPaymentByOrderId(
      orderId,
      req.user.sub,
      req.user.role === UserRole.ADMIN,
    );
  }

  // ─── Get Installment Schedule ──────────────────────────

  @Get(':orderId/installments')
  @UseGuards(JwtAuthGuard)
  getInstallmentSchedule(
    @Request() req: any,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.paymentsService.getInstallmentSchedule(
      orderId,
      req.user.sub,
      req.user.role === UserRole.ADMIN,
    );
  }

  // Deliberately no customer-facing "confirm my own payment" route. Doc 11
  // §10.1's whole payment security doctrine is "never trust frontend payment
  // status" — the only paths that may ever move a payment to COMPLETED are
  // ones with independent proof: the PayHere webhook (signature-verified),
  // the Stripe webhook below (signature-verified, and inert without a real
  // key), or an admin's own markPaymentPaid action (audited). A client
  // self-reporting "I paid" was previously reachable via the checkout page's
  // installment option and confirmPayment()/confirmInstallment() on
  // PaymentsService — removed here because nothing verified it actually
  // happened; any authenticated customer could mark any of their own orders
  // paid for free. Those service methods are still called internally by the
  // Stripe webhook handler below, which is safe specifically because it is
  // NOT reachable without a valid Stripe signature.

  // ─── PayHere Notify (server-to-server, public) ──────────

  @Post('payhere/notify')
  handlePayhereNotify(@Body() body: any) {
    return this.paymentsService.handlePayhereNotify(body);
  }

  // ─── Stripe Webhook ─────────────────────────────────────

  @Post('webhook')
  handleWebhook(
    @Request() req: any,
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(body));
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}
