import { Controller, Headers, Post, UseGuards, Request, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './strategy/local.strategy';
import { JwtAuthGuard } from './strategy/jwt.strategy';
import { Public } from './decorator/public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('register')
    /// authorization: Basic $token
    registerUser(@Headers('authorization') token: string) {
        return this.authService.register(token);
    }

    @Public()
    @Post('login')
    loginUser(@Headers('authorization') token: string) {
        return this.authService.login(token);
    }

    @Post('token/block')
    blockToken(@Body('token') token: string) {
        return this.authService.tokenBlock(token);
    }

    @Post('token/access') //refresh토큰 받아서 새로운 access token발급
    async rotateAccessToken(@Request() req) {
        return {
            accessToken: await this.authService.issueToken(req.user, false),
        };
    }

    @UseGuards(LocalAuthGuard)
    @Post('login/passport') //passport 전용 로그인 라우트
    async loginUserPassport(@Request() req) {
        return {
            refreshToken: await this.authService.issueToken(req.user, true),
            accessToken: await this.authService.issueToken(req.user, false),
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('private')
    async private(@Request() req) {
        return req.user;
    }
}