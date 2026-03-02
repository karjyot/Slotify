import { PrismaService } from '../services/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { ElasticsearchService } from 'src/elasticSearch/elasticsearch.service';
export declare class AuthService {
    private prisma;
    private jwt;
    private config;
    private readonly logger;
    private readonly redis;
    private searchService;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, logger: PinoLogger, redis: Redis, searchService: ElasticsearchService);
    register(dto: RegisterDto, image?: Express.Multer.File): Promise<{
        id: number;
        email: string;
        imageUrl: string | null;
    }>;
    login(dto: LoginDto, ip: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    getMe(userId: number): Promise<{
        imageUrl: string | null;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
    } | null>;
    private safeDeleteFile;
    refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private getLoginAttemptsKey;
    private incrementLoginAttempts;
}
