// =============================================
// emailService.js – Dịch vụ gửi email (Nodemailer)
// =============================================
// Cấu hình SMTP qua biến môi trường (.env)
// Hỗ trợ Gmail App Password

require('dotenv').config();
const nodemailer = require('nodemailer');

// Tạo transporter kết nối đến SMTP server
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true cho port 465, false cho 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Gửi email xác thực tài khoản.
 * @param {string} toEmail  - Email người nhận
 * @param {string} toName   - Tên người nhận
 * @param {string} token    - UUID token xác thực
 */
async function sendVerificationEmail(toEmail, toName, token) {
  const verifyUrl = `${process.env.BASE_URL}/api/auth/verify/${token}`;

  const mailOptions = {
    from:    process.env.SMTP_FROM || '"Army News VNAR" <no-reply@armynews.vn>',
    to:      toEmail,
    subject: '✅ Xác thực tài khoản – Army News VNAR',
    html: `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 560px; margin: 40px auto; background: #fff;
                       border-radius: 8px; overflow: hidden;
                       box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: #c0392b; padding: 32px; text-align: center; }
          .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 1px; }
          .header p  { color: rgba(255,255,255,0.85); margin: 4px 0 0; }
          .body { padding: 32px; color: #333; line-height: 1.6; }
          .body h2 { margin-top: 0; color: #1a1a2e; }
          .btn { display: inline-block; margin: 24px 0; padding: 14px 32px;
                 background: #c0392b; color: #fff !important; text-decoration: none;
                 border-radius: 6px; font-weight: bold; font-size: 16px; }
          .note { font-size: 13px; color: #888; margin-top: 16px; }
          .footer { background: #f0f0f0; padding: 16px; text-align: center;
                    font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚑ ARMY NEWS VNAR</h1>
            <p>Báo Điện Tử Quân Đội Nhân Dân Việt Nam</p>
          </div>
          <div class="body">
            <h2>Xin chào, ${toName}!</h2>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Army News VNAR</strong>.</p>
            <p>Vui lòng nhấn nút bên dưới để <strong>xác thực địa chỉ email</strong> của bạn:</p>
            <a href="${verifyUrl}" class="btn">Xác thực Email</a>
            <p class="note">
              Link xác thực có hiệu lực trong <strong>24 giờ</strong>.<br>
              Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.<br><br>
              Hoặc copy link: <a href="${verifyUrl}">${verifyUrl}</a>
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Army News VNAR. Mọi quyền được bảo lưu.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Đã gửi email xác thực đến ${toEmail}:`, info.messageId);
    return { success: true };
  } catch (err) {
    console.error('[Email] Lỗi gửi email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVerificationEmail };
