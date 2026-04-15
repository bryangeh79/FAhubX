import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    });
  }

  async validate(payload: any) {
    // 验证访问令牌是否在有效会话中
    try {
      await this.authService.validateAccessToken(payload.sub);
    } catch (error) {
      throw new UnauthorizedException('令牌已失效，请重新登录');
    }

    // 返回用户信息
    return {
      id: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role,
      status: 'active', // 实际应从数据库获取
    };
  }
}