import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow('FACEBOOK_APP_ID'),
      clientSecret: config.getOrThrow('FACEBOOK_APP_SECRET'),
      callbackURL: config.getOrThrow('FACEBOOK_CALLBACK_URL'),
      profileFields: ['id', 'emails'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: any, user?: any) => void,
  ) {
    const email = profile.emails?.[0]?.value;
    done(null, { provider: 'facebook', providerId: profile.id, email });
  }
}
