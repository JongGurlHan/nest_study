import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import e, { NextFunction, Request, Response } from 'express';
import { envVariableKeys } from 'src/common/const/env.const';

@Injectable()
export class BearerTokenMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        /// Basic $token
        /// Bearer $token
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            next();
            return;
        }

        const token = this.validateBearerToken(authHeader);

        const blockedToken = await this.cacheManager.get(`BLOCK_TOKEN_${token}`);

        if (blockedToken) {
            throw new UnauthorizedException('차단된 토큰입니다.');
        }

        const tokenKey = `TOKEN_${token}`;

        const cachedPayload = await this.cacheManager.get(tokenKey);

        if (cachedPayload) {
            req.user = cachedPayload;
            return next();
        }

        const decodedPayload = this.jwtService.decode(token);

        if (decodedPayload.type !== 'refresh' && decodedPayload.type !== 'access') {
            throw new UnauthorizedException('잘못된 토큰입니다!');
        }

        try {
            const secretKey =
                decodedPayload.type === 'refresh'
                    ? envVariableKeys.refreshTokenSecret
                    : envVariableKeys.accessTokenSecret;

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>(secretKey),
            });

            ///paload['exp'] -> epoch time seconds 1970년 1월 1일 0시 0분 0초부터 현재까지의 시간을 초로 환산한 값
            const expiryDate = +new Date(payload['exp'] * 1000); //1000을 곱해주는 이유는 Date객체가 밀리초 단위로 받기 때문에
            const now = +Date.now();

            const dirrerenceInSeconds = (expiryDate - now) / 1000;

            await this.cacheManager.set(tokenKey, payload, Math.max((dirrerenceInSeconds - 30) * 1000, 1)); //30초 전에 캐시가 만료되도록 설정

            req.user = payload;
            next();
        } catch (e) {
            if (e.name === 'TokenExpiredError') {
                throw new UnauthorizedException('토큰이 만료됐습니다.');
            }
            next();
        }
    }

    validateBearerToken(rawToken: string) {
        const basicSplit = rawToken.split(' ');

        if (basicSplit.length !== 2) {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [bearer, token] = basicSplit;

        if (bearer.toLowerCase() !== 'bearer') {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        return token;
    }
}
