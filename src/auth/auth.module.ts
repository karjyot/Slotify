import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../services/prisma.service';
import { JwtStrategy } from './jwt.startegy';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    QueueModule,
    PassportModule, // ✅ REQUIRED
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow('JWT_ACCESS_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    JwtStrategy, // ✅ THIS REGISTERS "jwt"
  ],
})
export class AuthModule {}
