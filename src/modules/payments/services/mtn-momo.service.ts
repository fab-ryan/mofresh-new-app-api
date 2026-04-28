import { Injectable, Logger, BadRequestException, HttpException } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface MoMoPaymentRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: string;
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

export interface MoMoPaymentResponse {
  transactionId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: string;
  currency: string;
  externalId: string;
  financialTransactionId?: string;
  reason?: string;
}

@Injectable()
export class MtnMomoService {
  private readonly logger = new Logger(MtnMomoService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiUser: string;
  private readonly apiKey: string;
  private readonly primaryKey: string;
  private readonly apiUrl: string;
  private readonly callbackUrl: string;
  private readonly environment: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {
    this.apiUser = this.configService.get<string>('MOMO_API_USER') || '';
    this.apiKey = this.configService.get<string>('MOMO_API_KEY') || '';
    this.primaryKey = this.configService.get<string>('MOMO_PRIMARY_KEY') || '';
    this.apiUrl =
      this.configService.get<string>('MOMO_API_URL') || 'https://sandbox.momodeveloper.mtn.com';
    this.callbackUrl = this.configService.get<string>('MOMO_CALLBACK_URL') || '';
    this.environment = this.configService.get<string>('MOMO_ENVIRONMENT') || 'sandbox';

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.primaryKey,
      },
    });

    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    const missing: string[] = [];

    if (!this.apiUser) missing.push('MOMO_API_USER');
    if (!this.apiKey) missing.push('MOMO_API_KEY');
    if (!this.primaryKey) missing.push('MOMO_PRIMARY_KEY');
    if (!this.apiUrl) missing.push('MOMO_API_URL');
    if (!this.callbackUrl) missing.push('MOMO_CALLBACK_URL');

    if (missing.length > 0) {
      this.logger.warn(
        `Missing MTN MoMo configuration: ${missing.join(', ')}. Payment processing will fail.`,
      );
    }
  }

  /**
   * OAuth access token with caching
   */
  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    try {
      const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');

      const response = await this.axiosInstance.post(
        '/collection/token/',
        {},
        {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        },
      );

      interface TokenResponse {
        access_token: string;
        expires_in?: number;
      }
      const tokenData = response.data as TokenResponse;
      const token = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600;

      this.tokenCache = {
        token,
        expiresAt: Date.now() + (expiresIn - 60) * 1000,
      };

      this.logger.log('MTN MoMo access token obtained successfully');
      return token;
    } catch (error: unknown) {
      this.logger.error('Failed to obtain MTN MoMo access token', this.getErrorDetails(error));
      throw new HttpException('Failed to authenticate with MTN MoMo', 500);
    }
  }

  /**
   * initiate payment request
   */
  async requestToPay(
    amount: number,
    phoneNumber: string,
    externalId: string,
    payerMessage?: string,
    payeeNote?: string,
  ): Promise<string> {
    this.logger.log(
      `Initiating MTN MoMo payment: ${amount} ${this.environment === 'sandbox' ? 'EUR' : 'RWF'} for ${phoneNumber}`,
    );

    const token = await this.getAccessToken();
    const referenceId = uuidv4();

    // EUR in sandbox testing, RWF for production
    const currency = this.environment === 'sandbox' ? 'EUR' : 'RWF';

    const payload: MoMoPaymentRequest = {
      amount: amount.toString(),
      currency,
      externalId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: this.sanitizePhoneNumber(phoneNumber),
      },
      payerMessage: payerMessage || 'MoFresh Invoice Payment',
      payeeNote: payeeNote || `Payment for invoice ${externalId}`,
    };

    try {
      await this.axiosInstance.post('/collection/v1_0/requesttopay', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.environment,
          'X-Callback-Url': this.callbackUrl,
        },
      });

      this.logger.log(`MTN MoMo payment initiated. Reference ID: ${referenceId}`);
      return referenceId;
    } catch (error: unknown) {
      this.logger.error('MTN MoMo request to pay failed', this.getErrorDetails(error));
      throw this.handleMoMoError(error);
    }
  }

  /**
   * check payment status
   */
  async getTransactionStatus(referenceId: string): Promise<MoMoPaymentResponse> {
    this.logger.log(`Checking MTN MoMo transaction status: ${referenceId}`);

    const token = await this.getAccessToken();

    try {
      const response = await this.axiosInstance.get(
        `/collection/v1_0/requesttopay/${referenceId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Target-Environment': this.environment,
          },
        },
      );

      const responseData = response.data as MoMoPaymentResponse;
      this.logger.log(`Transaction ${referenceId} status: ${responseData.status}`);
      return responseData;
    } catch (error: unknown) {
      this.logger.error('Failed to check transaction status', this.getErrorDetails(error));
      throw this.handleMoMoError(error);
    }
  }

  /**
   * webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (this.environment === 'sandbox') {
      return true;
    }

    const webhookSecret = this.configService.get<string>('MOMO_WEBHOOK_SECRET') || '';

    if (!webhookSecret) {
      this.logger.error(
        'MOMO_WEBHOOK_SECRET not configured in production. Webhook rejected for security.',
      );
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    // time-safe comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  }

  /**
   * sanitizing phone number to E.164 format
   */
  private sanitizePhoneNumber(phoneNumber: string): string {
    let sanitized = phoneNumber.replace(/\D/g, '');

    if (sanitized.startsWith('0')) {
      sanitized = '250' + sanitized.substring(1);
    } else if (!sanitized.startsWith('250')) {
      sanitized = '250' + sanitized;
    }

    if (sanitized.length !== 12) {
      throw new BadRequestException(
        `Invalid phone number format. Expected Rwanda number (e.g., 250788123456), got: ${phoneNumber}`,
      );
    }

    return sanitized;
  }

  /**
   * error handler
   */
  private handleMoMoError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data as Record<string, unknown>;

        switch (status) {
          case 400:
            return new BadRequestException(
              (data?.message as string) || 'Invalid payment request. Please check payment details.',
            );
          case 401:
            return new HttpException('MTN MoMo authentication failed', 401);
          case 409:
            return new BadRequestException('Duplicate transaction reference');
          case 500:
            return new HttpException('MTN MoMo service is temporarily unavailable', 503);
          default:
            return new HttpException(
              `MTN MoMo error: ${(data?.message as string) || 'Unknown error'}`,
              status,
            );
        }
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new HttpException('Payment request timeout. Please try again.', 504);
      }

      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return new HttpException('Cannot connect to MTN MoMo service', 503);
      }
    }

    return new HttpException('Payment processing failed. Please try again later.', 500);
  }

  /**
   *error details
   */
  private getErrorDetails(error: unknown): Record<string, unknown> {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return {
        message: axiosError.message,
        code: axiosError.code,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }

    return { error };
  }

  isConfigured(): boolean {
    return !!(this.apiUser && this.apiKey && this.primaryKey && this.callbackUrl);
  }
}
