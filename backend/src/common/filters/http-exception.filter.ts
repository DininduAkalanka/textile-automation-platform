import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global error envelope (CODING_STANDARDS §5.4, doc 07 §13).
 *
 * Two rules, both security-relevant:
 *
 * 1. NEVER return the message of an unrecognised error. This filter used to do
 *    `message = exception.message` for any Error, which handed the caller raw
 *    internals: a Prisma failure leaks table and constraint names, a config
 *    failure can leak a connection string. Unknown errors are logged in full
 *    server-side and answered with a fixed, generic message (doc 09 §2 —
 *    "fail securely, not silently"; doc 10 §13 — never show stack traces).
 *
 * 2. Every response uses the standard envelope, so the client always has a
 *    machine-readable `error.code` to branch on rather than parsing prose.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      // Deliberate, developer-authored errors are safe to surface.
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const resp = body as Record<string, unknown>;
        message = (resp.message as string | string[]) ?? exception.message;
        // A DTO can throw with an explicit code; otherwise derive one from the
        // HTTP status (e.g. 404 -> NOT_FOUND) so the client always gets one.
        code =
          (resp.code as string) ??
          (resp.error as string) ??
          HttpStatus[status] ??
          'ERROR';
      }
      code = String(code).toUpperCase().replace(/\s+/g, '_');
    } else {
      // Anything else is a bug or an infrastructure failure. Log everything,
      // tell the caller nothing.
      this.logger.error(
        `Unhandled ${exception instanceof Error ? exception.name : 'exception'} on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      error: { code },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
