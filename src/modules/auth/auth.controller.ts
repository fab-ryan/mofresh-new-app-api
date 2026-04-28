import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from '../users/dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshAuthGuard } from '../../common/guards/refresh-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: any;
    siteId: string | null;
    refreshToken?: string;
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Step 1: Check credentials and send OTP (if required)' })
  @ApiOkResponse({
    description: 'Login initiated - OTP sent if required, or tokens returned for CLIENT role',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Step 2: Verify OTP and get JWT' })
  @ApiOkResponse({ description: 'OTP verified successfully - access and refresh tokens returned' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Post('resend-otp')
  @Throttle({ default: { limit: 2, ttl: 300000 } })
  @ApiOperation({ summary: 'Resend OTP if expired or not received' })
  @ApiOkResponse({ description: 'New OTP sent successfully' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renew access token using refresh token' })
  @ApiOkResponse({ description: 'New access and refresh tokens generated' })
  async refresh(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const refreshToken = req.user.refreshToken;
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and invalidate refresh token' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  async logout(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.authService.logout(userId);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a 6-digit OTP code to the user email for password reset',
  })
  @ApiOkResponse({ description: 'Password reset code sent if email exists' })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset password using OTP',
    description: 'Verify OTP and set new password',
  })
  @ApiOkResponse({ description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }
}
