import { InjectRepository } from '@nestjs/typeorm';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role, User } from 'src/user/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { envVariableKeys } from 'src/common/const/env.const';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService, //auth.module에서 JwtModule.register에서 등록했기에 주입받을 수 있다.
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
    ) {}
    async tokenBlock(token: string) {
        const payload = this.jwtService.decode(token);

        const expiryDate = +new Date(payload['exp'] * 1000); //1000을 곱해주는 이유는 Date객체가 밀리초 단위로 받기 때문에
        const now = +Date.now();

        const dirrerenceInSeconds = (expiryDate - now) / 1000;

        await this.cacheManager.set(`BLOCK_TOKEN_${token}`, payload, Math.max(dirrerenceInSeconds * 1000, 1)); //30초 전에 캐시가 만료되도록 설정

        return true;
    }

    parseBasicToken(rawToken: string) {
        /// 1) 토큰을 ' '(띄어쓰기) 기준으로 스플릿 한 후 토큰 값만 추출하기
        /// ['Basic', $token]
        const basicSplit = rawToken.split(' '); //Basic dGVzZXJAbmF2ZXIuY29tOjExMTE=
        if (basicSplit.length !== 2) {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [basic, token] = basicSplit;

        if (basic.toLowerCase() !== 'basic') {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        /// 2) 추출한 토큰을 base64 디코딩해서 이메일과 비밀번호로 나눈다.
        const decoded = Buffer.from(token, 'base64').toString('utf-8'); //dGVzZXJAbmF2ZXIuY29tOjExMTE=를 변환

        /// "email:password"
        /// [email, password]
        const tokenSplit = decoded.split(':');

        if (tokenSplit.length !== 2) {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [email, password] = tokenSplit;

        return {
            email,
            password,
        };
    }

    async parseBearerToken(rawToken: string, isRefreshToken: boolean) {
        const basicSplit = rawToken.split(' '); //bearer dGVzZXJAbmF2ZXIuY29tOjExMTE=
        console.log('basicSplit', basicSplit);
        if (basicSplit.length !== 2) {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        const [bearer, token] = basicSplit;

        if (bearer.toLowerCase() !== 'bearer') {
            throw new BadRequestException('토큰 포맷이 잘못됐습니다!');
        }

        try {
            //decode: 검증은 안하고 payload만 가져온다.
            //verifyAsync: 검증을 하면서 payload를 가져온다.
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>(envVariableKeys.refreshTokenSecret),
            });

            if (isRefreshToken) {
                if (payload.type !== 'refresh') {
                    throw new BadRequestException('Refresh 토큰을 입력 해주세요!');
                }
            } else {
                if (payload.type !== 'access') {
                    throw new BadRequestException('Access 토큰을 입력 해주세요!');
                }
            }
            return payload;
        } catch (e) {
            throw new UnauthorizedException('토큰이 만료됐습니다!');
        }
    }

    async register(rawToken: string) {
        const { email, password } = this.parseBasicToken(rawToken);

        const user = await this.userRepository.findOne({
            where: {
                email,
            },
        });

        if (user) {
            throw new BadRequestException('이미 가입한 이메일 입니다!');
        }

        const hash = await bcrypt.hash(
            //(해쉬할 비번, 라운드: 숫자가 올라갈 수록 bcrypt가 해싱할때 걸리는 시간 올라간다, 라운드 넣어주면 솔트는 자동 생성)
            password,
            this.configService.get<number>(envVariableKeys.hashRounds),
        );

        await this.userRepository.save({
            email,
            password: hash,
        });

        return this.userRepository.findOne({
            where: {
                email,
            },
        });
    }

    async authenticate(email: string, password: string) {
        const user = await this.userRepository.findOne({
            where: {
                email,
            },
        });

        if (!user) {
            throw new BadRequestException('잘못된 로그인 정보입니다!');
        }

        const passOk = await bcrypt.compare(password, user.password); //암호화가 안된상태 , 된상태 password를 암호화해서 우측이랑 비교하게 된다.

        if (!passOk) {
            throw new BadRequestException('잘못된 로그인 정보입니다!');
        }

        return user;
    }

    async issueToken(user: { id: number; role: Role }, isRefreshToken: boolean) {
        const refreshTokenSecret = this.configService.get<string>(envVariableKeys.refreshTokenSecret);
        const accessTokenSecret = this.configService.get<string>(envVariableKeys.accessTokenSecret);

        return this.jwtService.signAsync(
            {
                sub: user.id,
                role: user.role,
                type: isRefreshToken ? 'refresh' : 'access',
            },
            {
                secret: isRefreshToken ? refreshTokenSecret : accessTokenSecret,
                expiresIn: isRefreshToken ? '24h' : 300,
            },
        );
    }

    async login(rawToken: string) {
        const { email, password } = this.parseBasicToken(rawToken);

        const user = await this.authenticate(email, password);

        return {
            refreshToken: await this.issueToken(user, true),
            accessToken: await this.issueToken(user, false),
        };
    }
}
