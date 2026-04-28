/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { MAIL_TRANSPORTER } from './mail-transporter.provider';
import { buildEmailWrapper } from '../../common/utils/email-template.helper';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private emailEnabled = true;

  constructor(
    private readonly configService: ConfigService,
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    const emailDisabled = this.configService.get<string>('DISABLE_EMAIL') === 'true';

    if (emailDisabled) {
      this.emailEnabled = false;
      this.logger.warn('⚠️ Email service is DISABLED via DISABLE_EMAIL env variable');
      return;
    }

    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.error('❌ SMTP_HOST not found - emails will not be sent');
      this.emailEnabled = false;
      return;
    }

    this.logger.log('✅ Nodemailer SMTP service ready');
    this.emailEnabled = true;
  }

  // ─── Send Password (Credentials) Email ───────────────────────────────────────
  async sendPasswordEmail(email: string, password: string, role: string) {
    if (!this.emailEnabled) {
      this.logger.log(`📧 [SKIPPED] Would send password email to: ${email}`);
      return;
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@mofresh.rw';
    const fromName = this.configService.get<string>('FROM_NAME') || 'MoFresh Support';

    const htmlContent = buildEmailWrapper(`

      <!-- Title -->
      <h1 style="
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
        color: #0E4521;
        font-family: Georgia, serif;
        line-height: 1.2;
      ">Welcome to MoFresh! </h1>

      <p style="
        margin: 0 0 28px;
        font-size: 15px;
        color: #5A7A68;
        font-family: Arial, sans-serif;
        line-height: 1.7;
      ">
        An account has been created for you. Below are your login credentials.
        Please keep them safe and change your password as soon as you log in.
      </p>

      <!-- Credentials card -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: linear-gradient(135deg, #F0FFF5, #FFFBEA);
          border: 1.5px solid #B8DFC8;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 28px;
        ">
        <tr>
          <td style="
            padding: 6px 0 0;
            background: linear-gradient(90deg, #1A7A3C, #F5C51A);
            height: 4px;
          "></td>
        </tr>
        <tr>
          <td style="padding: 24px 28px;">

            <!-- Email row -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="margin-bottom: 16px;">
              <tr>
                <td style="width: 24px; padding-right: 12px; vertical-align: middle;">
                </td>
                <td>
                  <p style="margin: 0; font-size: 11px; color: #8AAA96; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">Email Address</p>
                  <p style="margin: 2px 0 0; font-size: 15px; color: #0E4521; font-family: Arial, sans-serif; font-weight: 600;">${email}</p>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <div style="height: 1px; background: #D4EBC9; margin-bottom: 16px;"></div>

            <!-- Password row -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
              style="margin-bottom: 16px;">
              <tr>
                </td>
                <td>
                  <p style="margin: 0; font-size: 11px; color: #8AAA96; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">Temporary Password</p>
                  <p style="
                    margin: 2px 0 0; font-size: 18px; color: #0E4521;
                    font-family: 'Courier New', monospace; font-weight: 700;
                    background: #FFF8D6; padding: 4px 10px; border-radius: 6px;
                    display: inline-block; letter-spacing: 2px;
                  ">${password}</p>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <div style="height: 1px; background: #D4EBC9; margin-bottom: 16px;"></div>

            <!-- Role row -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="width: 24px; padding-right: 12px; vertical-align: middle;">
                </td>
                <td>
                  <p style="margin: 0; font-size: 11px; color: #8AAA96; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">Account Role</p>
                  <p style="
                    margin: 2px 0 0; font-size: 13px; color: white;
                    font-family: Arial, sans-serif; font-weight: 600;
                    background: #1A7A3C; padding: 3px 10px; border-radius: 20px;
                    display: inline-block; text-transform: capitalize;
                  ">${role}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

      <!-- Warning notice -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: #FFFBEA;
          border-left: 4px solid #F5C51A;
          border-radius: 0 8px 8px 0;
          margin-bottom: 8px;
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
              ⚠️ <strong>Action Required:</strong> For your security, please log in and change
              this temporary password immediately. Never share your credentials with anyone.
            </p>
          </td>
        </tr>
      </table>

    `);

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Your MoFresh Account Credentials',
        html: htmlContent,
      });
      this.logger.log(`✅ Password email sent to: ${email} (MsgID: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`❌ Email send failure: ${error.message}`);
    }
  }

  // ─── Send OTP Email ───────────────────────────────────────────────────────────
  async sendOtpEmail(email: string, otp: string) {
    if (!this.emailEnabled) {
      this.logger.log(`📧 [SKIPPED] Would send OTP ${otp} to: ${email}`);
      return;
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@mofresh.rw';
    const fromName = this.configService.get<string>('FROM_NAME') || 'MoFresh Support';

    const htmlContent = buildEmailWrapper(`

      <!-- Icon circle -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
        style="margin-bottom: 24px;">
        <tr>
          <td align="center">
          </td>
        </tr>
      </table>

      <!-- Title -->
      <h1 style="
        margin: 0 0 10px;
        font-size: 26px;
        font-weight: 700;
        color: #0E4521;
        font-family: Georgia, serif;
        text-align: center;
        line-height: 1.2;
      ">Verification Code</h1>

      <p style="
        margin: 0 0 32px;
        font-size: 15px;
        color: #5A7A68;
        font-family: Arial, sans-serif;
        line-height: 1.7;
        text-align: center;
      ">
        Use the code below to verify your identity.<br/>This code is valid for <strong style="color: #1A7A3C;">5 minutes</strong> only.
      </p>

      <!-- OTP Display box -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"
        style="margin: 0 auto 32px;">
        <tr>
          <td style="
            background: linear-gradient(135deg, #0E4521, #1A7A3C);
            border-radius: 16px;
            padding: 28px 48px;
            text-align: center;
            box-shadow: 0 8px 24px rgba(14,69,33,0.25);
          ">
            <!-- OTP digits split for spacing effect -->
            <p style="
              margin: 0 0 8px;
              font-size: 11px;
              color: rgba(245,197,26,0.8);
              font-family: Arial, sans-serif;
              text-transform: uppercase;
              letter-spacing: 3px;
            ">Your Code</p>
            <p style="
              margin: 0;
              font-size: 48px;
              font-weight: 900;
              color: #F5C51A;
              font-family: 'Courier New', Courier, monospace;
              letter-spacing: 12px;
              line-height: 1;
              text-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">${otp}</p>
          </td>
        </tr>
      </table>

      <!-- Timer warning -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="
          background: #F0FFF5;
          border: 1.5px solid #B8DFC8;
          border-radius: 10px;
        ">
        <tr>
          <td style="padding: 14px 20px;" align="center">
            <p style="
              margin: 0;
              font-size: 13px;
              color: #4A7A5A;
              font-family: Arial, sans-serif;
            ">
              ⏱ This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
            </p>
          </td>
        </tr>
      </table>

    `);

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Your MoFresh Verification Code',
        html: htmlContent,
      });
      this.logger.log(`✅ OTP email sent to: ${email} (MsgID: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`❌ Email send failure: ${error.message}`);
    }
  }

  // ─── Generic Send Email ───────────────────────────────────────────────────────
  async sendEmail(to: string, subject: string, content: string) {
    if (!this.emailEnabled) {
      this.logger.log(`📧 [SKIPPED] Would send email to: ${to}`);
      return;
    }

    const fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@mofresh.rw';
    const fromName = this.configService.get<string>('FROM_NAME') || 'MoFresh Support';

    const htmlContent = buildEmailWrapper(`
      <h1 style="
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 700;
        color: #0E4521;
        font-family: Georgia, serif;
      ">${subject}</h1>
      <div style="
        font-size: 15px;
        color: #3A5A48;
        font-family: Arial, sans-serif;
        line-height: 1.8;
      ">
        ${content}
      </div>
    `);

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: to,
        subject: subject,
        html: htmlContent,
      });
      this.logger.log(`✅ Email sent to: ${to} (MsgID: ${info.messageId})`);
    } catch (error: any) {
      this.logger.error(`❌ Email send failure: ${error.message}`);
    }
  }
}
