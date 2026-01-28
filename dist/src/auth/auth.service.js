"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../services/prisma.service");
const password_utill_1 = require("./password.utill");
const jwt_1 = require("@nestjs/jwt");
const reset_token_util_1 = require("./utils/reset-token.util");
const rabbitmq_service_1 = require("../queue/rabbitmq.service");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const config_1 = require("@nestjs/config");
const nestjs_pino_1 = require("nestjs-pino");
const ioredis_1 = __importDefault(require("ioredis"));
const common_2 = require("@nestjs/common");
const constants_1 = require("./constants");
const token_util_1 = require("./utils/token.util");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwt;
    rabbit;
    config;
    logger;
    redis;
    constructor(prisma, jwt, rabbit, config, logger, redis) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.rabbit = rabbit;
        this.config = config;
        this.logger = logger;
        this.redis = redis;
        this.logger.setContext(AuthService_1.name);
    }
    async register(dto, image) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (existingUser) {
            if (image) {
                await this.safeDeleteFile(image.path);
            }
            throw new common_1.BadRequestException('Email already registered');
        }
        const passwordHash = await (0, password_utill_1.hashPassword)(dto.password);
        const imageUrl = image
            ? `/uploads/${image.filename}`
            : null;
        try {
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
            return {
                id: user.id,
                email: user.email,
                imageUrl: user.imageUrl,
            };
        }
        catch (error) {
            if (image) {
                await this.safeDeleteFile(image.path);
            }
            throw error;
        }
    }
    async login(dto, ip) {
        const redisKey = this.getLoginAttemptsKey(dto.email, ip);
        const attempts = Number(await this.redis.get(redisKey)) || 0;
        if (attempts >= constants_1.MAX_LOGIN_ATTEMPTS) {
            throw new common_1.HttpException('Too many login attempts. Please try again later.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
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
            await this.incrementLoginAttempts(redisKey, attempts);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await (0, password_utill_1.comparePassword)(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            await this.incrementLoginAttempts(redisKey, attempts);
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        await this.redis.del(redisKey);
        const accessToken = (0, token_util_1.generateAccessToken)(this.jwt, {
            sub: user.id,
            email: user.email,
            roles: user.roles.map(r => r.role.name),
        });
        const refreshToken = (0, token_util_1.generateRefreshToken)();
        const refreshHash = (0, token_util_1.hashRefreshToken)(refreshToken);
        await this.prisma.authSession.create({
            data: {
                userId: user.id,
                refreshHash,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return {
            accessToken,
            refreshToken,
        };
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) {
            return { message: 'If email exists, reset link will be sent' };
        }
        const token = (0, reset_token_util_1.generateResetToken)();
        const tokenHash = (0, reset_token_util_1.hashResetToken)(token);
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        await this.rabbit.publish('send_email', {
            type: 'FORGOT_PASSWORD',
            email: user.email,
            token,
            retryCount: 0,
        });
        console.log('RESET TOKEN (for testing):', token);
        return { message: 'If email exists, reset link will be sent' };
    }
    async getMe(userId) {
        this.logger.info({ userId: userId }, 'Fetch User Details');
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
        if (!user)
            return null;
        this.logger.info(user, 'User Details');
        return {
            ...user,
            imageUrl: user.imageUrl
                ? `${this.config.get('APP_URL')}${user.imageUrl}`
                : null,
        };
    }
    async safeDeleteFile(filePath) {
        try {
            await fs.unlink(path.resolve(filePath));
        }
        catch (err) {
            console.warn('Failed to cleanup file:', filePath);
        }
    }
    async refreshToken(refreshToken) {
        const refreshHash = (0, token_util_1.hashRefreshToken)(refreshToken);
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
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (session.revokedAt || session.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token expired');
        }
        const newRefreshToken = (0, token_util_1.generateRefreshToken)();
        const newRefreshHash = (0, token_util_1.hashRefreshToken)(newRefreshToken);
        await this.prisma.authSession.update({
            where: { id: session.id },
            data: {
                refreshHash: newRefreshHash,
            },
        });
        const roles = session.user.roles.map((userRole) => userRole.role.name);
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
    getLoginAttemptsKey(email, ip) {
        return `login_attempts:${email}:${ip}`;
    }
    async incrementLoginAttempts(key, attempts) {
        if (attempts === 0) {
            await this.redis.set(key, '1', 'EX', constants_1.LOGIN_WINDOW_SECONDS);
        }
        else {
            await this.redis.incr(key);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_2.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, jwt_1.JwtService,
        rabbitmq_service_1.RabbitMQService,
        config_1.ConfigService,
        nestjs_pino_1.PinoLogger,
        ioredis_1.default])
], AuthService);
//# sourceMappingURL=auth.service.js.map