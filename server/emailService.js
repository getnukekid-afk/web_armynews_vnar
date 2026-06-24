// =============================================
// emailService.js – Dịch vụ gửi email (Nodemailer)
// =============================================
// Hỗ trợ: Gmail SMTP trực tiếp + Gmail OAuth2 (fallback)
// Debug: chi tiết lỗi SMTP, connection test, env vars check

require('dotenv').config();
const nodemailer = require('nodemailer');

// ─── Diagnostics: log cấu hình SMTP khi khởi động ───
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

console.log('[Email] ── Cấu hình SMTP ──');
console.log(`[Email]   HOST : ${smtpHost}`);
console.log(`[Email]   PORT : ${smtpPort}`);
console.log(`[Email]   USER : ${smtpUser || '❌ CHƯA SET'}`);
console.log(`[Email]   PASS : ${smtpPass ? `✅ (${smtpPass.length} ký tự)` : '❌ CHƯA SET'}`);
console.log(`[Email]   FROM : ${process.env.SMTP_FROM || '(auto)'}`);

// ─── Tạo transporter ────────────────────────
let transporter = null;

function createTransporter() {
  // Nếu thiếu credentials → không tạo transporter
  if (!smtpUser || !smtpPass) {
    console.error('[Email] ❌ SMTP_USER hoặc SMTP_PASS chưa được cấu hình!');
    return null;
  }

  const t = nodemailer.createTransport({
    host:   smtpHost,
    port:   smtpPort,
    secure: smtpPort === 465,  // true cho 465, false cho 587
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // Timeout settings — Render.com có thể chậm kết nối SMTP
    connectionTimeout: 10000,  // 10s chờ kết nối
    greetingTimeout:   10000,  // 10s chờ server greeting
    socketTimeout:     15000,  // 15s chờ response
    // Debug
    logger: false,
    debug:  false,
  });

  // Verify kết nối async
  t.verify()
    .then(() => console.log('[Email] ✅ SMTP kết nối thành công!'))
    .catch(err => {
      console.error('[Email] ❌ SMTP verify thất bại:', err.message);
      console.error('[Email]    Full error:', JSON.stringify({
        code: err.code,
        command: err.command,
        response: err.response,
      }));
    });

  return t;
}

transporter = createTransporter();

// ─── Helper: địa chỉ gửi ────────────────────
function getSender() {
  const from = process.env.SMTP_FROM;
  if (from && !from.includes('your_email@')) return from;
  return `"Army News VNAR" <${smtpUser || 'no-reply@armynews.vn'}>`;
}

// ─── Core: gửi email với retry ───────────────
async function sendMail(mailOptions) {
  if (!transporter) {
    const errMsg = 'SMTP transporter chưa được khởi tạo (thiếu SMTP_USER/SMTP_PASS).';
    console.error(`[Email] ❌ ${errMsg}`);
    return { success: false, error: errMsg };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] ✅ Gửi thành công đến ${mailOptions.to} – MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] ❌ Gửi thất bại đến ${mailOptions.to}`);
    console.error(`[Email]    Error: ${err.message}`);
    console.error(`[Email]    Code: ${err.code || 'N/A'}`);
    console.error(`[Email]    Command: ${err.command || 'N/A'}`);
    console.error(`[Email]    Response: ${err.response || 'N/A'}`);

    // Nếu lỗi authentication → log rõ hơn
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.error('[Email] ⚠️  Lỗi xác thực Gmail! Kiểm tra:');
      console.error('[Email]     1. SMTP_PASS phải là App Password (16 ký tự, không khoảng trắng)');
      console.error('[Email]     2. Tạo tại: myaccount.google.com → Security → App passwords');
      console.error('[Email]     3. Bật 2FA trước khi tạo App Password');
    }

    return { success: false, error: err.message, code: err.code };
  }
}

// ─── Chẩn đoán SMTP (dùng cho test-smtp endpoint) ───
async function diagnoseSmtp() {
  const diag = {
    envVars: {
      SMTP_HOST: smtpHost,
      SMTP_PORT: smtpPort,
      SMTP_USER: smtpUser || '❌ CHƯA SET',
      SMTP_PASS_LENGTH: smtpPass ? smtpPass.length : 0,
      SMTP_PASS_HAS_SPACES: smtpPass ? smtpPass.includes(' ') : false,
      SMTP_PASS_PREVIEW: smtpPass ? smtpPass.slice(0, 4) + '****' + smtpPass.slice(-4) : '❌ CHƯA SET',
      SMTP_FROM: process.env.SMTP_FROM || '(auto)',
    },
    transporterExists: !!transporter,
    verifyResult: null,
  };

  if (!transporter) {
    diag.verifyResult = { success: false, error: 'Transporter null – thiếu credentials' };
    return diag;
  }

  try {
    await transporter.verify();
    diag.verifyResult = { success: true, message: 'SMTP kết nối OK' };
  } catch (err) {
    diag.verifyResult = {
      success: false,
      error: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
    };
  }

  return diag;
}

/**
 * Gửi email xác thực tài khoản.
 */
async function sendVerificationEmail(toEmail, toName, token, baseUrl) {
  const base      = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${base}/api/auth/verify/${token}`;

  return sendMail({
    from:    getSender(),
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
  });
}

/**
 * Gửi email đặt lại mật khẩu.
 */
async function sendPasswordResetEmail(toEmail, toName, token, baseUrl) {
  const base     = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const resetUrl = `${base}/reset-password?token=${token}`;

  return sendMail({
    from:    getSender(),
    to:      toEmail,
    subject: '🔑 Đặt lại mật khẩu – Army News VNAR',
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
          .warning { background: #fff8e1; border-left: 4px solid #f39c12;
                     padding: 12px 16px; border-radius: 4px; margin-top: 16px; font-size: 13px; }
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
            <p>Chúng tôi nhận được yêu cầu <strong>đặt lại mật khẩu</strong> cho tài khoản của bạn tại <strong>Army News VNAR</strong>.</p>
            <p>Nhấn nút bên dưới để tạo mật khẩu mới:</p>
            <a href="${resetUrl}" class="btn">🔑 Đặt lại mật khẩu</a>
            <div class="warning">
              ⏰ Link này chỉ có hiệu lực trong <strong>1 giờ</strong>. Sau đó bạn cần yêu cầu lại.
            </div>
            <p class="note">
              Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.<br><br>
              Hoặc copy link: <a href="${resetUrl}">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Army News VNAR. Mọi quyền được bảo lưu.
          </div>
        </div>
      </body>
      </html>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, diagnoseSmtp, sendMail };
