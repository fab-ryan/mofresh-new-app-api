# Email Service Migration: Brevo → Nodemailer

## Summary
Successfully replaced Brevo email service with Nodemailer SMTP for all email functionality.

## Changes Made

### 1. **mail-transporter.provider.ts**
- Replaced Brevo API initialization with Nodemailer SMTP transporter
- Now configures SMTP connection using standard SMTP credentials
- Returns a Nodemailer `Transporter` instance

### 2. **mail.service.ts**
- Updated to use Nodemailer `Transporter` instead of Brevo `TransactionalEmailsApi`
- Changed email sending from `brevo.sendTransacEmail()` to `transporter.sendMail()`
- All three methods updated:
  - `sendPasswordEmail()` - Sends account credentials
  - `sendOtpEmail()` - Sends OTP verification codes
  - `sendEmail()` - Generic email sender

### 3. **Resetmail.service.ts**
- Updated to use Nodemailer `Transporter`
- Changed `sendPasswordResetEmail()` to use `transporter.sendMail()`

### 4. **password.mailservice.ts**
- Updated to use Nodemailer `Transporter`
- Changed `sendClientCredentials()` to use `transporter.sendMail()`

### 5. **.env.example**
- Added new SMTP configuration variables:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your-email@example.com
  SMTP_PASS=your-app-password
  FROM_EMAIL=noreply@mofresh.rw
  FROM_NAME=MoFresh Support
  DISABLE_EMAIL=false
  ```

## Environment Variables

### Old (Brevo):
```
BREVO_API_KEY=your-brevo-api-key
FROM_EMAIL=noreply@mofresh.rw
DISABLE_EMAIL=false
```

### New (SMTP):
```
SMTP_HOST=smtp.gmail.com          # Your SMTP server host
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@example.com  # SMTP username/email
SMTP_PASS=your-app-password       # SMTP password or app password
FROM_EMAIL=noreply@mofresh.rw     # Sender email address
FROM_NAME=MoFresh Support         # Sender name (optional, defaults to "MoFresh Support")
DISABLE_EMAIL=false               # Set to 'true' to disable email sending
```

## SMTP Provider Configuration Examples

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
```
**Note**: Use [App Passwords](https://support.google.com/accounts/answer/185833) for Gmail (not your regular password).

### Outlook/Office365
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-smtp-password
```

### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## Dependencies

### Already Installed
- `nodemailer` (^7.0.13) ✓
- `@types/nodemailer` (^7.0.9) ✓

### Can Be Removed (Optional)
- `@getbrevo/brevo` - No longer needed, can be removed from package.json

To remove Brevo:
```bash
npm uninstall @getbrevo/brevo
```

## Testing

1. Update your `.env` file with valid SMTP credentials
2. Start the application: `npm run start:dev`
3. Test email functionality:
   - User registration (credentials email)
   - OTP verification
   - Password reset

## Benefits of This Migration

1. **Flexibility**: Use any SMTP provider (Gmail, SendGrid, AWS SES, etc.)
2. **Cost**: Many SMTP providers offer generous free tiers
3. **Simplicity**: Standard SMTP protocol, no vendor-specific API
4. **Portability**: Easy to switch between email providers
5. **Control**: Full control over SMTP configuration and delivery

## Rollback Instructions

If you need to revert to Brevo:

1. Checkout the previous commit with Brevo integration
2. Restore `BREVO_API_KEY` in your `.env` file
3. Reinstall Brevo: `npm install @getbrevo/brevo@^3.0.1`

## Support

For SMTP configuration issues:
- Check SMTP credentials are correct
- Verify firewall/network allows outbound connections on SMTP port
- Enable "Less secure app access" or use app passwords for Gmail
- Review logs for detailed error messages
