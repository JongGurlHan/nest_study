import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Public } from '../decorator/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    //public 데코레이션이 있다면 모든 로직을 bypass
    const isPublic = this.reflector.get(Public, context.getHandler());

    //public 이라는 애노테이션이 있으면, 정확히 말해서 객체 값이 있으면 무조건 true 반환
    if (isPublic) {
      return true;
    }

    //요청에서 user객체가 존재하는 지 확인하다.
    const request = context.switchToHttp().getRequest();

    if (!request.user || request.user.type !== 'access') {
      return false;
    }

    return true;
  }
}
