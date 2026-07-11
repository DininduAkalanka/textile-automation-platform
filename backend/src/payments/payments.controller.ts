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
import {
  CreateFullPaymentDto,
  CreateInstallmentPaymentDto,
} from './dto/create-payment.dto';
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

  // ─── Full Payment ───────────────────────────────────────

  @Post('full')
  @UseGuards(JwtAuthGuard)
  createFullPayment(
    @Request() req: any,
    @Body() dto: CreateFullPaymentDto,
  ) {
    return this.paymentsService.createFullPayment(dto.orderId, req.user.sub);
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

  // ─── Installment Payment ────────────────────────────────

  @Post('installment')
  @UseGuards(JwtAuthGuard)
  createInstallmentPayment(
    @Request() req: any,
    @Body() dto: CreateInstallmentPaymentDto,
  ) {
    return this.paymentsService.createInstallmentPayment(
      dto.orderId,
      req.user.sub,
      dto.installmentCount,
    );
  }

  // ─── Pay Individual Installment ──────────────────────────

  @Post('installment/:installmentId/pay')
  @UseGuards(JwtAuthGuard)
  payInstallment(
    @Request() req: any,
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
  ) {
    return this.paymentsService.payInstallment(installmentId, req.user.sub);
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
  markPaid(@Request() req: any, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.markPaymentPaid(orderId, req.user.sub);
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
  getPayment(@Request() req: any, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.getPaymentByOrderId(
      orderId,
      req.user.sub,
      req.user.role === UserRole.ADMIN,
    );
  }

  // ─── Get Installment Schedule ──────────────────────────

  @Get(':orderId/installments')
  @UseGuards(JwtAuthGuard)
  getInstallmentSchedule(@Request() req: any, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.getInstallmentSchedule(
      orderId,
      req.user.sub,
      req.user.role === UserRole.ADMIN,
    );
  }

  // ─── Confirm Payment (mock — for when Stripe is not configured) ──

  @Post('confirm/:orderId')
  @UseGuards(JwtAuthGuard)
  confirmPayment(@Request() req: any, @Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.confirmPayment(orderId, req.user.sub);
  }

  // ─── Confirm Installment (mock) ─────────────────────────

  @Post('confirm-installment/:installmentId')
  @UseGuards(JwtAuthGuard)
  confirmInstallment(
    @Request() req: any,
    @Param('installmentId', ParseUUIDPipe) installmentId: string,
  ) {
    return this.paymentsService.confirmInstallment(installmentId, req.user.sub);
  }

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
