import { JwtService } from '@nestjs/jwt';
export declare function generateAccessToken(jwt: JwtService, payload: {
    sub: number;
    email: string;
    roles: any;
}): string;
export declare function generateRefreshToken(): string;
export declare function hashRefreshToken(token: string): string;
