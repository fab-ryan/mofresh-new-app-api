/* eslint-disable prettier/prettier */
const LOGO_ONLINE_URL = 'https://res.cloudinary.com/ds34h7zrm/image/upload/v1771831208/MoFresh_Logo_or1xxr.png';
const LOGO_LOCAL_FALLBACK = 'mofresh/src/assets/images/MoFreshLogo.png';

export function buildEmailWrapper(bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>MoFresh</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="
  margin: 0;
  padding: 0;
  background-color: #F0F7EC;
  font-family: Georgia, 'Times New Roman', serif;
  -webkit-font-smoothing: antialiased;
">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
  style="background-color: #F0F7EC; min-height: 100vh;">
  <tr>
    <td align="center" style="padding: 40px 16px;">

      <!-- Email card -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
        style="max-width: 600px; background-color: #ffffff; border-radius: 20px;
               overflow: hidden; box-shadow: 0 8px 40px rgba(26,122,60,0.13);">

        <!-- ═══════════════ HEADER ═══════════════ -->
        <tr>
          <td style="
            background: linear-gradient(135deg, #1A7A3C 0%, #145F2F 60%, #0E4521 100%);
            padding: 0;
            position: relative;
          ">
            <!-- Top accent bar -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="height: 6px; background: linear-gradient(90deg, #F5C51A 0%, #FFD84D 50%, #F5C51A 100%);"></td>
              </tr>
            </table>

            <!-- Logo + brand area -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td align="center" style="padding: 36px 40px 28px;">

                  <!-- Logo image with online + local fallback -->
                  <img
                    src="${LOGO_ONLINE_URL}"
                    onerror="this.onerror=null; this.src='${LOGO_LOCAL_FALLBACK}';"
                    alt="MoFresh Logo"
                    width="160"
                    style="
                      display: block;
                      max-width: 160px;
                      height: auto;
                      margin: 0 auto 12px;
                      filter: brightness(0) invert(1);
                    "
                  />

                  <!-- Fallback text logo if image fails completely -->
                  <div style="display: none;" class="logo-text-fallback">
                    <span style="
                      font-size: 32px;
                      font-weight: 900;
                      color: #F5C51A;
                      letter-spacing: -1px;
                    ">Mo</span><span style="
                      font-size: 32px;
                      font-weight: 900;
                      color: #ffffff;
                      letter-spacing: -1px;
                    ">Fresh</span>
                  </div>

                  <!-- Decorative leaf divider -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════════ BODY ═══════════════ -->
        <tr>
          <td style="padding: 44px 48px 36px; background: #ffffff;">
            ${bodyContent}
          </td>
        </tr>

        <!-- ═══════════════ FOOTER ═══════════════ -->
        <tr>
          <td style="
            background: linear-gradient(180deg, #F8FDF5 0%, #EDF7E7 100%);
            padding: 0;
            border-top: 1px solid #D4EBC9;
          ">
            <!-- Yellow accent line at bottom -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 28px 40px 12px;" align="center">

                  <!-- Footer Logo -->
                  <img
                    src="${LOGO_ONLINE_URL}"
                    onerror="this.onerror=null; this.src='${LOGO_LOCAL_FALLBACK}';"
                    alt="MoFresh"
                    width="90"
                    style="
                      display: block;
                      max-width: 90px;
                      height: auto;
                      margin: 0 auto 16px;
                      opacity: 0.75;
                    "
                  />

                  <p style="
                    margin: 0 0 6px;
                    font-size: 13px;
                    color: #4A7A5A;
                    font-family: Georgia, serif;
                    font-style: italic;
                  ">Fresh Delivered. Freshness Guaranteed.</p>

                  <p style="
                    margin: 0 0 16px;
                    font-size: 11px;
                    color: #8AAA96;
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                  ">
                    This is an automated message from MoFresh. Please do not reply to this email.<br/>
                    If you did not request this, please ignore it or contact our support team.
                  </p>

                </td>
              </tr>

              <!-- Bottom yellow bar -->
              <tr>
                <td style="
                  height: 5px;
                  background: linear-gradient(90deg, #1A7A3C, #F5C51A, #1A7A3C);
                  border-radius: 0 0 20px 20px;
                "></td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Email card -->

      <!-- Below card note -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px;">
        <tr>
          <td align="center" style="padding: 20px 0 0;">
            <p style="
              margin: 0;
              font-size: 11px;
              color: #8AAA96;
              font-family: Arial, sans-serif;
            ">© 2026 MoFresh. All rights reserved.</p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>
  `.trim();
}
