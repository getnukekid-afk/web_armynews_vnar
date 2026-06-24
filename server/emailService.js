// =============================================
// emailService.js – Dịch vụ gửi email
// =============================================
// Hỗ trợ 2 transport:
//   1. RESEND HTTP API (dùng cho Render.com / cloud) ← ưu tiên
//   2. SMTP / Nodemailer (dùng cho local dev)
//
// Render.com free tier chặn SMTP (port 25/465/587).
// Resend.com miễn phí 100 email/ngày, dùng built-in fetch().

require('dotenv').config();

// ─── Detect transport mode ───────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const USE_RESEND     = !!RESEND_API_KEY;

let nodemailerTransporter = null;

if (USE_RESEND) {
  console.log('[Email] ✅ Transport: Resend HTTP API');
} else {
  // Fallback: SMTP / Nodemailer (chỉ dùng cho local dev)
  const nodemailer = require('nodemailer');
  const smtpUser   = process.env.SMTP_USER;
  const smtpPass   = process.env.SMTP_PASS;
  const smtpHost   = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort   = parseInt(process.env.SMTP_PORT) || 587;

  console.log('[Email] ⚠️  Transport: SMTP (Nodemailer)');
  console.log(`[Email]    HOST: ${smtpHost}:${smtpPort}`);
  console.log(`[Email]    USER: ${smtpUser || '❌ CHƯA SET'}`);

  if (smtpUser && smtpPass) {
    nodemailerTransporter = nodemailer.createTransport({
      host:   smtpHost,
      port:   smtpPort,
      secure: smtpPort === 465,
      auth:   { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout:   10000,
      socketTimeout:     15000,
    });

    nodemailerTransporter.verify()
      .then(() => console.log('[Email] ✅ SMTP kết nối thành công!'))
      .catch(err => {
        console.error('[Email] ❌ SMTP verify thất bại:', err.message);
        console.error('[Email]    Nếu trên cloud → set RESEND_API_KEY để dùng Resend HTTP API.');
      });
  } else {
    console.error('[Email] ❌ Thiếu SMTP_USER hoặc SMTP_PASS!');
  }
}

// ─── Helper: địa chỉ gửi ────────────────────
function getSender() {
  // Resend: phải dùng domain đã verify, hoặc onboarding@resend.dev
  if (USE_RESEND) {
    // Resend: CHỈ dùng RESEND_FROM nếu đã verify domain riêng
    // KHÔNG fallback sang SMTP_FROM (gmail.com không verify được trên Resend)
    const resendFrom = process.env.RESEND_FROM;
    if (resendFrom && !resendFrom.includes('gmail.com') && !resendFrom.includes('your_email@')) {
      return resendFrom;
    }
    return 'Army News VNAR <onboarding@resend.dev>';
  }
  // SMTP: dùng SMTP_FROM hoặc SMTP_USER
  const from = process.env.SMTP_FROM;
  if (from && !from.includes('your_email@')) return from;
  return `"Army News VNAR" <${process.env.SMTP_USER || 'no-reply@armynews.vn'}>`;
}

// ─── Core: gửi email qua Resend HTTP API ─────
async function sendViaResend(to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    getSender(),
        to:      Array.isArray(to) ? to : [to],
        subject: subject,
        html:    html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[Email] ❌ Resend API lỗi (${res.status}):`, JSON.stringify(data));
      return { success: false, error: data.message || JSON.stringify(data) };
    }

    console.log(`[Email] ✅ Gửi thành công qua Resend đến ${to} – ID: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (err) {
    console.error(`[Email] ❌ Resend fetch lỗi:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Core: gửi email qua SMTP ────────────────
async function sendViaSmtp(to, subject, html) {
  if (!nodemailerTransporter) {
    const msg = 'SMTP transporter chưa sẵn sàng. Set RESEND_API_KEY để dùng Resend.';
    console.error(`[Email] ❌ ${msg}`);
    return { success: false, error: msg };
  }

  try {
    const info = await nodemailerTransporter.sendMail({
      from:    getSender(),
      to:      to,
      subject: subject,
      html:    html,
    });
    console.log(`[Email] ✅ Gửi SMTP thành công đến ${to} – MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] ❌ SMTP gửi thất bại đến ${to}:`, err.message);
    return { success: false, error: err.message, code: err.code };
  }
}

// ─── Unified send (auto-chọn transport) ──────
async function sendMail(mailOptions) {
  const { to, subject, html, text } = mailOptions;
  if (USE_RESEND) {
    return sendViaResend(to, subject, html || text);
  }
  return sendViaSmtp(to, subject, html || text);
}

// ─── Chẩn đoán (dùng cho test endpoint) ──────
async function diagnoseSmtp() {
  const diag = {
    transport: USE_RESEND ? 'Resend HTTP API' : 'SMTP (Nodemailer)',
    resendConfigured: !!RESEND_API_KEY,
    smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
    envVars: {
      RESEND_API_KEY: RESEND_API_KEY ? `✅ (${RESEND_API_KEY.slice(0, 8)}...)` : '❌ CHƯA SET',
      SMTP_HOST: process.env.SMTP_HOST || '(chưa set)',
      SMTP_PORT: process.env.SMTP_PORT || '(chưa set)',
      SMTP_USER: process.env.SMTP_USER || '❌ CHƯA SET',
      SMTP_PASS_LENGTH: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
      SMTP_FROM: process.env.SMTP_FROM || '(auto)',
      RESEND_FROM: process.env.RESEND_FROM || '(mặc định: onboarding@resend.dev)',
    },
    verifyResult: null,
  };

  if (USE_RESEND) {
    // Test Resend bằng cách gọi API domains endpoint
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
      });
      const data = await res.json();
      diag.verifyResult = res.ok
        ? { success: true, message: 'Resend API key hợp lệ', domains: data.data?.map(d => d.name) || [] }
        : { success: false, error: data.message || 'API key không hợp lệ' };
    } catch (err) {
      diag.verifyResult = { success: false, error: err.message };
    }
  } else if (nodemailerTransporter) {
    try {
      await nodemailerTransporter.verify();
      diag.verifyResult = { success: true, message: 'SMTP kết nối OK' };
    } catch (err) {
      diag.verifyResult = { success: false, error: err.message, code: err.code };
    }
  } else {
    diag.verifyResult = { success: false, error: 'Không có transport nào sẵn sàng' };
  }

  return diag;
}

// ─── Email xác thực tài khoản ────────────────
async function sendVerificationEmail(toEmail, toName, token, baseUrl) {
  const base      = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const verifyUrl = `${base}/api/auth/verify/${token}`;

  return sendMail({
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

// ─── Email đặt lại mật khẩu ─────────────────
async function sendPasswordResetEmail(toEmail, toName, token, baseUrl) {
  const base     = baseUrl || process.env.BASE_URL || 'http://localhost:3000';
  const resetUrl = `${base}/reset-password?token=${token}`;

  return sendMail({
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
            <p>Chúng tôi nhận được yêu cầu <strong>đặt lại mật khẩu</strong> cho tài khoản của bạn.</p>
            <p>Nhấn nút bên dưới để tạo mật khẩu mới:</p>
            <a href="${resetUrl}" class="btn">🔑 Đặt lại mật khẩu</a>
            <div class="warning">
              ⏰ Link này chỉ có hiệu lực trong <strong>1 giờ</strong>. Sau đó bạn cần yêu cầu lại.
            </div>
            <p class="note">
              Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.<br><br>
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
