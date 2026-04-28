import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ResetEmailService } from './Resetmail.service';
import { PasswordEmailService } from './password.mailservice';
import { mailTransporterProvider } from './mail-transporter.provider';

@Module({
  providers: [mailTransporterProvider, MailService, ResetEmailService, PasswordEmailService],
  exports: [MailService, ResetEmailService, PasswordEmailService],
})
export class MailModule {}
