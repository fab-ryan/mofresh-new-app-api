import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export const MAIL_TRANSPORTER = 'MAIL_TRANSPORTER';

export const mailTransporterProvider = {
  provide: MAIL_TRANSPORTER,
  useFactory: (configService: ConfigService): Transporter => {
    const logger = new Logger('MailTransporter');
    const emailDisabled = configService.get<string>('DISABLE_EMAIL') === 'true';

    if (emailDisabled) {
      logger.warn('⚠️ Email service is DISABLED via DISABLE_EMAIL env variable');
      // Return a mock transporter
      return nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
      });
    }

    const smtpHost = configService.get<string>('SMTP_HOST');
    const smtpPort = configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = configService.get<string>('SMTP_USER');
    const smtpPass = configService.get<string>('SMTP_PASS');

    if (!smtpHost) {
      logger.error('❌ SMTP configuration not complete (SMTP_HOST, SMTP_USER, SMTP_PASS required)');
      // throw new Error('Email service not configured');
    }

    logger.log(`📧 Initializing Nodemailer SMTP service (${smtpHost}:${smtpPort})`);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      ...(smtpPass && smtpUser
        ? {
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          }
        : {}),
    });

    return transporter;
  },
  inject: [ConfigService],
};
