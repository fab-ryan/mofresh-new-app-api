import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { UserRole } from '@prisma/client';
import { ResetEmailService } from '../mail/Resetmail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const MOCK_USER_ID = 'user-123';
const MOCK_EMAIL = 'test@example.com';
const MOCK_OTP_CODE = '123456';
const DUMMY_HASH = '$2b$10$dummy_hash_for_testing';
const MOCK_JWT_TOKEN = 'mocked_jwt_token';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    otp: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
  };

  const mockJwtService = { signAsync: jest.fn() };
  const mockMailService = { sendOtpEmail: jest.fn() };
  const mockResetEmailService = { sendPasswordResetEmail: jest.fn() };
  const mockAuditLogsService = { createAuditLog: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: ResetEmailService, useValue: mockResetEmailService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('verifyOtp', () => {
    it('should return success and tokens if OTP is valid', async () => {
      mockPrisma.otp.findFirst.mockResolvedValue({
        email: MOCK_EMAIL,
        code: MOCK_OTP_CODE,
        expiresAt: new Date(Date.now() + 60000),
      });

      mockPrisma.user.findFirst.mockResolvedValue({
        id: MOCK_USER_ID,
        email: MOCK_EMAIL,
        role: UserRole.CLIENT,
        password: DUMMY_HASH,
        deletedAt: null,
        isActive: true,
      });

      mockJwtService.signAsync.mockResolvedValue(MOCK_JWT_TOKEN);
      const result = await service.verifyOtp(MOCK_EMAIL, MOCK_OTP_CODE);

      expect(result.status).toBe('success');
      expect(result.accessToken).toBe(MOCK_JWT_TOKEN);
      expect(result.refreshToken).toBe(MOCK_JWT_TOKEN);
      expect(result.user).not.toHaveProperty('password');
    });
  });
});
