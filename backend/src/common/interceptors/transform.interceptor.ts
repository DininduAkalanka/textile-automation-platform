import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * The standard success envelope (CODING_STANDARDS §5.3):
 *
 *   { success, message, data, error }
 *
 * `message` and `error` were missing, so the client had no uniform place to look
 * for either. They are added here rather than changing `data`, keeping existing
 * consumers working.
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  error: null;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: null,
        data,
        error: null,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
