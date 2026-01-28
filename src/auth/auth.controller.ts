import { Body, Controller, Post,Get,Req,UseGuards,  UploadedFile,
    UseInterceptors,
   } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RolesGuard } from './guards/role.guard';
import { Roles } from './decorators/role.decorator';
import { Ip } from '@nestjs/common';



@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => {
          const uniqueName =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueName + extname(file.originalname));
        },
      }),
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only images allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    }),
  )
  register(@Body() dto: RegisterDto,@UploadedFile() image?: Express.Multer.File,
) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request,@Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
return this.authService.forgotPassword(dto);
   }
   
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
    }
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Get('admin-only')
    getAdminData() {
    return 'Only admins can see this';
    }

    @Post('refresh')
refresh(@Body('refreshToken') refreshToken: string) {
  return this.authService.refreshToken(refreshToken);
}
}
