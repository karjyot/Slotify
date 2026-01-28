import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto, image?: Express.Multer.File): Promise<{
        id: number;
        email: string;
        imageUrl: string | null;
    }>;
    login(dto: LoginDto, req: Request, ip: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    getMe(req: any): Promise<{
        imageUrl: string | null;
        id: number;
        createdAt: Date;
        email: string;
        isActive: boolean;
    } | null>;
    getAdminData(): string;
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
}
