import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserRole } from '@prisma/client';

const MOCK_EMAIL = 'test@example.com';
const TEST_KEY = 'Strong_T3st_Key!123';
const MOCK_CODE = '123456';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            resendOtp: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should call AuthService login method', async () => {
      const loginDto = { email: MOCK_EMAIL, password: TEST_KEY };
      const result = {
        status: 'otp_sent',
        message: 'Verification code sent to email.',
        email: MOCK_EMAIL,
      };

      jest.spyOn(authService, 'login').mockResolvedValue(result);

      const response = await authController.login(loginDto);
      expect(response).toEqual(result);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.login).toHaveBeenCalledWith(MOCK_EMAIL, TEST_KEY);
    });
  });

  describe('resendOtp', () => {
    it('should call AuthService resendOtp method', async () => {
      const resendOtpDto: ResendOtpDto = { email: MOCK_EMAIL };
      const result = { status: 'otp_sent', message: 'OTP sent', email: MOCK_EMAIL };

      jest.spyOn(authService, 'resendOtp').mockResolvedValue(result);
      const response = await authController.resendOtp(resendOtpDto);
      expect(response).toEqual(result);
    });
  });

  describe('verifyOtp', () => {
    it('should call AuthService verifyOtp method', async () => {
      const verifyOtpDto: VerifyOtpDto = { email: MOCK_EMAIL, code: MOCK_CODE };
      const result = {
        status: 'success',
        message: 'Login successful',
        accessToken: 'mock_jwt_token',
        refreshToken: 'mock_refresh_token',
        user: {
          id: '1',
          email: MOCK_EMAIL,
          role: UserRole.SUPPLIER,
          firstName: 'John',
          lastName: 'Doe',
          phone: '12345',
          isActive: true,
          isProfileComplete: false,
          siteId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      jest.spyOn(authService, 'verifyOtp').mockResolvedValue(result as any);
      const response = await authController.verifyOtp(verifyOtpDto);
      expect(response).toEqual(result);
    });
  });
});
