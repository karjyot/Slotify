import { Injectable, BadRequestException, UnauthorizedException,HttpException,HttpStatus } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { hashPassword,comparePassword } from './password.utill';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { generateResetToken, hashResetToken } from './utils/reset-token.util';
//import { RabbitMQService } from '../queue/rabbitmq.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import {MAX_LOGIN_ATTEMPTS,LOGIN_WINDOW_SECONDS} from './constants'
import { ElasticsearchService } from 'src/elasticSearch/elasticsearch.service';



import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from './utils/token.util';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService,
    //private rabbit: RabbitMQService,
    private config: ConfigService,
    private readonly logger: PinoLogger,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private searchService: ElasticsearchService,




  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto, image?: Express.Multer.File) {
    // 1️⃣ Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
  
    if (existingUser) {
      // 🔥 cleanup uploaded image if email already exists
      if (image) {
        await this.safeDeleteFile(image.path);
      }
      throw new BadRequestException('Email already registered');
    }
  
    const passwordHash = await hashPassword(dto.password);
  
    const imageUrl = image
      ? `/uploads/${image.filename}`
      : null;
  
    try {
      // 2️⃣ Create user
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          imageUrl,
          roles: {
            create: {
              role: {
                connect: { name: 'USER' },
              },
            },
          },
        },
      });
      await this.searchService.getClient().index({
        index: 'users',
        id: user.id.toString(),
        document: {
          id: user.id,
          email: user.email,
          name: user.name,
          imageUrl: user.imageUrl,
          createdAt: user.createdAt,
        },
      });
  
      return {
        id: user.id,
        email: user.email,
        imageUrl: user.imageUrl, // ✅ FIXED (was `true`)
      };
  
    } catch (error) {
      // 🔥 cleanup uploaded image if DB create fails
      if (image) {
        await this.safeDeleteFile(image.path);
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ip: string) {
    const redisKey = this.getLoginAttemptsKey(dto.email, ip);
  
    // 🔥 1️⃣ Check current attempts
    const attempts = Number(await this.redis.get(redisKey)) || 0;
  
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
        throw new HttpException(
            'Too many login attempts. Please try again later.',
            HttpStatus.TOO_MANY_REQUESTS, // 429
          );
    }
  
    // 2️⃣ Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  
    if (!user || !user.isActive) {
      // ❌ count failure
      await this.incrementLoginAttempts(redisKey, attempts);
      throw new UnauthorizedException('Invalid credentials');
    }
  
    // 3️⃣ Verify password
    const isPasswordValid = await comparePassword(
      dto.password,
      user.passwordHash,
    );
  
    if (!isPasswordValid) {
      // ❌ count failure
      await this.incrementLoginAttempts(redisKey, attempts);
      throw new UnauthorizedException('Invalid credentials');
    }
  
    // ✅ 4️⃣ SUCCESS → clear Redis attempts
    await this.redis.del(redisKey);
  
    // 5️⃣ Generate access token
    const accessToken = generateAccessToken(this.jwt, {
      sub: user.id,
      email: user.email,
      roles: user.roles.map(r => r.role.name),
    });
  
    // 6️⃣ Generate refresh token
    const refreshToken = generateRefreshToken();
    const refreshHash = hashRefreshToken(refreshToken);
  
    // 7️⃣ Store refresh session
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  
    // 8️⃣ Return tokens
    return {
      accessToken,
      refreshToken,
    };
  }
  

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
  
    // IMPORTANT: do NOT reveal whether user exists
    if (!user) {
      return { message: 'If email exists, reset link will be sent' };
    }
  
    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
  
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });
  
    // await this.rabbit.publish('send_email', {
    //     type: 'FORGOT_PASSWORD',
    //     email: user.email,
    //     token,
    //     retryCount: 0,

    //   });
  
    console.log('RESET TOKEN (for testing):', token);
  
    return { message: 'If email exists, reset link will be sent' };
  }

  async getMe(userId: number) {
    this.logger.info(
        { userId: userId},
        'Fetch User Details',
      );
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        imageUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
  
    if (!user) return null;
    this.logger.info(user,
        'User Details',
      );
    return {
      ...user,
      imageUrl: user.imageUrl
        ? `${this.config.get('APP_URL')}${user.imageUrl}`
        : null,
    };
    
  }

  private async safeDeleteFile(filePath: string) {
    try {
      await fs.unlink(path.resolve(filePath));
    } catch (err) {
      // never crash API because of cleanup
      console.warn('Failed to cleanup file:', filePath);
    }
  }
  
  async refreshToken(refreshToken: string) {
    const refreshHash = hashRefreshToken(refreshToken);
  
    const session = await this.prisma.authSession.findUnique({
      where: { refreshHash },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
  
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }
  
    // 🔁 ROTATION
    const newRefreshToken = generateRefreshToken();
    const newRefreshHash = hashRefreshToken(newRefreshToken);
  
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshHash: newRefreshHash,
      },
    });
  
    const roles = session.user.roles.map(
      (userRole) => userRole.role.name,
    );
  
    const accessToken = this.jwt.sign({
      sub: session.user.id,
      email: session.user.email,
      roles,
    });
  
    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
  
  private getLoginAttemptsKey(email: string, ip: string) {
    return `login_attempts:${email}:${ip}`;
  }
  private async incrementLoginAttempts(key: string, attempts: number) {
    if (attempts === 0) {
      // first failure → set with TTL
      await this.redis.set(key, '1', 'EX', LOGIN_WINDOW_SECONDS);
    } else {
      // subsequent failures → increment only
      await this.redis.incr(key);
    }
  }

}
