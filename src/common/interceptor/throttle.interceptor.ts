import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, ForbiddenException, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Throttle } from '../decorator/throttle.decorator';

@Injectable()
export class ThrottleInterceptor implements NestInterceptor {
    constructor(
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
        private readonly reflector: Reflector, //throttle 에노테이션한것만 throttle을 적용하기 위해
    ) {}
    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();

        // URL_USERID_MINUTE //어떤 URL로 유저가 몇분에 몇번 요청했는지 VALUE로 알고 싶어서
        // VALUE -> count

        const userId = request?.user?.sub;

        //로그인 안한 유저는 통과
        if (!userId) {
            return next.handle();
        }

        const throttleOptions = this.reflector.get<{ count: number; unit: 'minute' }>(Throttle, context.getHandler());

        //데코레이터를 적용하지 않은 엔드포인트 통과
        if (!throttleOptions) {
            return next.handle();
        }

        const date = new Date();
        const minute = date.getMinutes();

        const key = `${request.method}_${request.path}_${userId}_${minute}`;

        const count = await this.cacheManager.get<number>(key); //키값 별로 몇번 요청했는지 확인
        console.log('key', key);
        console.log('count', count);

        //데코레이터에서 지정한 요청회수보다 많으면
        if (count && count >= throttleOptions.count) {
            throw new ForbiddenException('요청 가능 횟수를 넘어섰습니다.');
        }

        return next.handle().pipe(
            tap(async () => {
                const count = (await this.cacheManager.get<number>(key)) ?? 0;

                this.cacheManager.set(key, count + 1, 60000);
            }),
        );
    }
}
