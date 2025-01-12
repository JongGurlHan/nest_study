import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { delay, Observable, tap } from 'rxjs';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();

    const reqTIme = Date.now();
    return next.handle().pipe(
      tap(() => {
        const respTime = Date.now();
        const diff = respTime - reqTIme;
        console.log(`[${req.method} ${req.path} ${diff}ms]`);
      }),
    );
  }
}
