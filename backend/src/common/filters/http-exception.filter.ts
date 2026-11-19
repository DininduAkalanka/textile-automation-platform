import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Errors that are the caller's fault but are not HttpExceptions. Only fixed,
 * developer-written messages are returned — never the library's own text,
 * which can name tables, constraints or internals.
 */
export function classifyKnownError(
  exception: unknown,
): { status: number; code: string; message: string } | null {
  // body-parser (express.json / urlencoded) errors carry `type` and a 4xx
  // `status` (http-errors).
  const e = exception as { type?: unknown; status?: unknown; expose?: unknown };
  if (exception instanceof Error && typeof e.type === 'string') {
    if (e.type === 'entity.too.large') {
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
      };
    }
    if (
      e.expose === true &&
      typeof e.status === 'number' &&
      e.status >= 400 &&
      e.status < 500
    ) {
      return {
        status: e.status,
        code: 'MALFORMED_REQUEST',
        message: 'The request body could not be read. Send valid JSON.',
      };
    }
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const fields = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : 'value';
      return {
        status: HttpStatus.CONFLICT,
        code: 'DUPLICATE',
        message: `Another record already uses this ${fields}.`,
      };
    }
    if (exception.code === 'P2025') {
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'NOT_FOUND',
        message: 'The record was not found.',
      };
    }
  }
  return null;
}

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

    const known = classifyKnownError(exception);
    if (known) {
      // QA P2-4: client mistakes that are not HttpExceptions — an oversized or
      // malformed body (body-parser), a duplicate unique value or a missing
      // record (Prisma) — used to fall through to the 500 branch below. They
      // are the CALLER's error, so they get a 4xx with a safe, fixed message.
      status = known.status;
      code = known.code;
      message = known.message;
    } else if (exception instanceof HttpException) {
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
