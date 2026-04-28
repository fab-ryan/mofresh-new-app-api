/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { MAIL_TRANSPORTER } from './mail-transporter.provider';
import { buildEmailWrapper } from '../../common/utils/email-template.helper';

@Injectable()
export class PasswordEmailService {
  private readonly logger = new Logger(PasswordEmailService.name);
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

  async sendClientCredentials(email: string, password: string, firstName: string): Promise<void> {
    if (!this.emailEnabled) {
      this.logger.log(`📧 [SKIPPED] Would send credentials to: ${email}`);
      return;
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@mofresh.rw';
    const fromName = this.configService.get<string>('FROM_NAME') || 'MoFresh Support';

    const htmlContent = buildEmailWrapper(`

      <!-- Welcome banner -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: linear-gradient(135deg, #1A7A3C 0%, #25A053 100%);
          border-radius: 14px;
          margin-bottom: 32px;
          overflow: hidden;
        ">
        <tr>
          <td style="padding: 28px 32px;" align="center">
            <p style="
              margin: 0 0 6px;
              font-size: 13px;
              color: rgba(245,197,26,0.9);
              font-family: Arial, sans-serif;
              text-transform: uppercase;
              letter-spacing: 3px;
            ">Welcome Aboard</p>
            <h1 style="
              margin: 0;
              font-size: 30px;
              font-weight: 700;
              color: #ffffff;
              font-family: Georgia, serif;
              line-height: 1.2;
            ">Hello, ${firstName}! 👋</h1>
            <p style="
              margin: 10px 0 0;
              font-size: 14px;
              color: rgba(255,255,255,0.8);
              font-family: Arial, sans-serif;
            ">Your MoFresh account has been created successfully.</p>
          </td>
        </tr>
      </table>

      <!-- Section label -->
      <p style="
        margin: 0 0 14px;
        font-size: 13px;
        color: #8AAA96;
        font-family: Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-weight: 600;
      ">Your Login Credentials</p>

      <!-- Credentials card -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: #FAFFF8;
          border: 1.5px solid #B8DFC8;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 28px;
        ">

        <!-- Email row -->
        <tr>
          <td style="padding: 18px 24px; border-bottom: 1px solid #D4EBC9;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 36px; vertical-align: middle; padding-right: 14px;">
              
                </td>
                <td>
                  <p style="margin: 0 0 2px; font-size: 11px; color: #8AAA96; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">Email Address</p>
                  <p style="margin: 0; font-size: 15px; color: #0E4521; font-family: Arial, sans-serif; font-weight: 600;">${email}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Password row -->
        <tr>
          <td style="padding: 18px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 36px; vertical-align: middle; padding-right: 14px;">
                  <div style="
                    width: 36px; height: 36px;
                    background: #FFF9E0;
                    border-radius: 10px;
                    text-align: center;
                    line-height: 36px;
                    font-size: 16px;
                  ">🔑</div>
                </td>
                <td>
                  <p style="margin: 0 0 4px; font-size: 11px; color: #8AAA96; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">Temporary Password</p>
                  <p style="
                    margin: 0;
                    font-size: 20px;
                    color: #0E4521;
                    font-family: 'Courier New', monospace;
                    font-weight: 700;
                    background: #FFF8D6;
                    border: 1.5px dashed #D4B800;
                    padding: 6px 14px;
                    border-radius: 8px;
                    display: inline-block;
                    letter-spacing: 3px;
                  ">${password}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <!-- Steps section -->
      <p style="
        margin: 0 0 14px;
        font-size: 13px;
        color: #8AAA96;
        font-family: Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-weight: 600;
      ">Getting Started</p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="margin-bottom: 28px;">

        <!-- Step 1 -->
        <tr>
          <td style="padding-bottom: 14px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 32px; vertical-align: top; padding-right: 14px;">
                  <div style="
                    width: 28px; height: 28px;
                    background: #1A7A3C;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 28px;
                    font-size: 13px;
                    font-weight: 700;
                    color: white;
                    font-family: Arial, sans-serif;
                  ">1</div>
                </td>
                <td style="vertical-align: middle;">
                  <p style="margin: 0; font-size: 14px; color: #3A5A48; font-family: Arial, sans-serif; line-height: 1.6;">
                    Log in using your email and the temporary password above.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Step 2 -->
        <tr>
          <td style="padding-bottom: 14px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 32px; vertical-align: top; padding-right: 14px;">
                  <div style="
                    width: 28px; height: 28px;
                    background: #F5C51A;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 28px;
                    font-size: 13px;
                    font-weight: 700;
                    color: #0E4521;
                    font-family: Arial, sans-serif;
                  ">2</div>
                </td>
                <td style="vertical-align: middle;">
                  <p style="margin: 0; font-size: 14px; color: #3A5A48; font-family: Arial, sans-serif; line-height: 1.6;">
                    Navigate to <strong>Settings → Security</strong> and change your password immediately.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Step 3 -->
        <tr>
          <td>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 32px; vertical-align: top; padding-right: 14px;">
                  <div style="
                    width: 28px; height: 28px;
                    background: #1A7A3C;
                    border-radius: 50%;
                    text-align: center;
                    line-height: 28px;
                    font-size: 13px;
                    font-weight: 700;
                    color: white;
                    font-family: Arial, sans-serif;
                  ">3</div>
                </td>
                <td style="vertical-align: middle;">
                  <p style="margin: 0; font-size: 14px; color: #3A5A48; font-family: Arial, sans-serif; line-height: 1.6;">
                    Enjoy MoFresh — fresh products, delivered fast! 
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Security notice -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: #FFFBEA;
          border-left: 4px solid #F5C51A;
          border-radius: 0 8px 8px 0;
        ">
        <tr>
          <td style="padding: 14px 18px;">
            <p style="
              margin: 0;
              font-size: 13px;
              color: #7A6000;
              font-family: Arial, sans-serif;
              line-height: 1.6;
            ">
              ⚠️ Never share your password with anyone — including MoFresh staff. We will <strong>never</strong> ask for your password.
            </p>
          </td>
        </tr>
      </table>

    `);

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Welcome to MoFresh — Your Account is Ready!',
        html: htmlContent,
      });
      this.logger.log(`✅ Welcome email sent to: ${email} (MsgID: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`❌ Email send failure: ${error.message}`);
    }
  }
}
