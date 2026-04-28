/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { MAIL_TRANSPORTER } from './mail-transporter.provider';
import { buildEmailWrapper } from '../../common/utils/email-template.helper';

@Injectable()
export class ResetEmailService {
  private readonly logger = new Logger(ResetEmailService.name);
  private readonly emailEnabled: boolean = true;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
  ) {
    const emailDisabled = this.configService.get<string>('DISABLE_EMAIL') === 'true';
    if (emailDisabled) {
      (this as any).emailEnabled = false;
      this.logger.warn('⚠️ Email service is DISABLED');
    }
  }

  async sendPasswordResetEmail(email: string, otpCode: string) {
    if (!this.emailEnabled) {
      this.logger.log(`📧 [SKIPPED] Would send reset OTP to: ${email}`);
      return;
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@mofresh.rw';
    const fromName = this.configService.get<string>('FROM_NAME') || 'MoFresh Support';

    const htmlContent = buildEmailWrapper(`

      <!-- Shield icon -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
        style="margin-bottom: 24px;">
        <tr>
        </tr>
      </table>

      <!-- Heading -->
      <h1 style="
        margin: 0 0 10px;
        font-size: 26px;
        font-weight: 700;
        color: #0E4521;
        font-family: Georgia, serif;
        text-align: center;
      ">Password Reset</h1>

      <p style="
        margin: 0 0 30px;
        font-size: 15px;
        color: #5A7A68;
        font-family: Arial, sans-serif;
        line-height: 1.7;
        text-align: center;
      ">
        We received a request to reset your MoFresh password.<br/>
        Use the code below — it expires in <strong style="color: #1A7A3C;">5 minutes</strong>.
      </p>

      <!-- OTP Display -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
        style="margin: 0 auto 32px; width: 100%;">
        <tr>
          <td style="
            background: linear-gradient(135deg, #FFFBEA, #FFF3B0);
            border: 2.5px solid #F5C51A;
            border-radius: 16px;
            padding: 28px 32px;
            text-align: center;
          ">
            <p style="
              margin: 0 0 6px;
              font-size: 11px;
              color: #9A8000;
              font-family: Arial, sans-serif;
              text-transform: uppercase;
              letter-spacing: 3px;
            ">Reset Code</p>

            <!-- Individual digit boxes -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
              <tr>
                ${otpCode
                  .split('')
                  .map(
                    (digit) => `
                <td style="
                  width: 44px; height: 56px;
                  background: #ffffff;
                  border: 2px solid #D4B800;
                  border-radius: 10px;
                  text-align: center;
                  vertical-align: middle;
                  margin: 0 4px;
                  padding: 0 6px;
                ">
                  <span style="
                    font-size: 32px;
                    font-weight: 900;
                    color: #0E4521;
                    font-family: 'Courier New', monospace;
                    line-height: 1;
                  ">${digit}</span>
                </td>
                `,
                  )
                  .join('')}
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Security notice -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="
            background: #FFF8F8;
            border-left: 4px solid #E05555;
            border-radius: 0 8px 8px 0;
            padding: 14px 18px;
            margin-bottom: 8px;
          ">
            <p style="
              margin: 0;
              font-size: 13px;
              color: #7A3333;
              font-family: Arial, sans-serif;
              line-height: 1.6;
            ">
              <strong>Didn't request this?</strong> Your account is safe — simply ignore this email.
              If this concerns you, contact us at
              <a href="mailto:info@mofresh.rw" style="color: #1A7A3C;">info@mofresh.rw</a>.
            </p>
          </td>
        </tr>
      </table>

    `);

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Password Reset Request – MoFresh',
        html: htmlContent,
      });
      this.logger.log(`✅ Reset email sent to: ${email} (MsgID: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`❌ Email send failure: ${error.message}`);
    }
  }
}
