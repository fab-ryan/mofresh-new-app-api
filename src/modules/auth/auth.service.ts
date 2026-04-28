import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { HashingUtil } from '../../common/utils/hashing.util';
import { MailService } from '../mail/mail.service';
import { randomInt } from 'node:crypto';
import { UserRole, User, AuditAction } from '@prisma/client';
import { ResetEmailService } from '../mail/Resetmail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly resetEmailService: ResetEmailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private checkRequiresOtp(role: UserRole): boolean {
    const rolesWithOtp: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.SITE_MANAGER,
      UserRole.SUPPLIER,
    ];
    return rolesWithOtp.includes(role);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    if (!user || !(await HashingUtil.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.checkRequiresOtp(user.role)) {
      return this.generateAndSendOtp(user.email, user.id);
    }

    return this.directLogin(user);
  }

  private async directLogin(user: User) {
    const tokens = await this.getTokens(user.id, user.email, user.role, user.siteId);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditLogsService.createAuditLog(user.id, AuditAction.UPDATE, 'USER', user.id, {
      email: user.email,
      method: 'direct',
      action: 'LOGIN',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, deletedAt, ...userWithoutSensitiveData } = user;

    return {
      status: 'success',
      message: 'Login successful',
      ...tokens,
      user: userWithoutSensitiveData,
    };
  }

  async verifyOtp(email: string, code: string) {
    const otpRecord = await this.prisma.otp.findFirst({
      where: { email, code, expiresAt: { gt: new Date() } },
    });

    if (!otpRecord) throw new BadRequestException('Invalid or expired verification code');

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    if (!user) throw new UnauthorizedException('User not found');

    await this.prisma.otp.deleteMany({ where: { email } });

    const tokens = await this.getTokens(user.id, user.email, user.role, user.siteId);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditLogsService.createAuditLog(user.id, AuditAction.UPDATE, 'USER', user.id, {
      email: user.email,
      method: 'otp',
      action: 'LOGIN',
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, deletedAt, ...userWithoutSensitiveData } = user;

    return {
      status: 'success',
      message: 'Login successful',
      ...tokens,
      user: userWithoutSensitiveData,
    };
  }

  async getTokens(userId: string, email: string, role: UserRole, siteId: string | null) {
    const payload = { sub: userId, email, role, siteId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: (process.env.JWT_EXPIRES_IN as any) || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN as any) || '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await HashingUtil.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }

  async refreshTokens(userId: string, rt: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        refreshToken: true,
        isActive: true,
        deletedAt: true,
        siteId: true,
      },
    });

    const userRt = user?.refreshToken;
    if (!user || !userRt || user.deletedAt || !user.isActive) {
      throw new ForbiddenException('Access Denied');
    }

    const matches = await HashingUtil.compare(rt, userRt);
    if (!matches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(user.id, user.email, user.role, user.siteId);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return { status: 'success', ...tokens };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    await this.auditLogsService.createAuditLog(userId, AuditAction.UPDATE, 'USER', userId, {
      action: 'LOGOUT',
      message: 'User logged out',
    });

    return { status: 'success', message: 'Logged out successfully' };
  }

  async resendOtp(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    await this.prisma.otp.deleteMany({ where: { email } });
    return this.generateAndSendOtp(user.email, user.id);
  }

  private async generateAndSendOtp(email: string, userId: string) {
    const otpCode = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.otp.create({ data: { email, code: otpCode, userId, expiresAt } });
    await this.mailService.sendOtpEmail(email, otpCode);
    return { status: 'otp_sent', message: 'Verification code sent.', email };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    if (!user) {
      return {
        status: 'success',
        message: 'If an account exists with this email, a password reset code has been sent.',
      };
    }

    await this.prisma.otp.deleteMany({ where: { email } });

    const otpCode = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.otp.create({
      data: { email, code: otpCode, userId: user.id, expiresAt },
    });

    await this.resetEmailService.sendPasswordResetEmail(email, otpCode);

    return {
      status: 'success',
      message: 'If an account exists with this email, a password reset code has been sent.',
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const otpRecord = await this.prisma.otp.findFirst({
      where: { email, code, expiresAt: { gt: new Date() } },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hashedPassword = await HashingUtil.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });

    await this.prisma.otp.deleteMany({ where: { email } });

    await this.auditLogsService.createAuditLog(user.id, AuditAction.UPDATE, 'USER', user.id, {
      action: 'password_reset',
      email: user.email,
    });

    return {
      status: 'success',
      message: 'Password has been reset successfully. Please login with your new password.',
    };
  }
}
