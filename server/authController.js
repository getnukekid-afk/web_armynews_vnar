// =============================================
// authController.js – Xử lý Xác thực Người dùng
// =============================================
// Gồm: đăng ký, đăng nhập, đăng xuất, xác thực email
// Middleware: isAuthenticated, requireRole

const bcrypt       = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db           = require('./dbConfig');
const { sendVerificationEmail, sendPasswordResetEmail } = require('./emailService');

// ─────────────────────────────────────────────
// HELPER: Xác thực Google reCAPTCHA v2 token
// ─────────────────────────────────────────────
async function verifyRecaptcha(token) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  // Nếu chưa cấu hình (dev mode) → bỏ qua
  if (!secretKey) {
    console.warn('[Auth] RECAPTCHA_SECRET_KEY chưa được cấu hình – bỏ qua kiểm tra.');
    return true;
  }
  if (!token) return false;

  try {
    // Node.js v22+ có built-in fetch
    const res  = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('[Auth] Lỗi verify reCAPTCHA:', err.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// HELPER: Tự detect Base URL từ request
// Ưu tiên: biến môi trường BASE_URL (nếu đã set đúng trên render.com)
// Fallback: lấy từ request headers (x-forwarded-proto + host)
// ─────────────────────────────────────────────
function getBaseUrl(req) {
  const envUrl = process.env.BASE_URL;
  // Nếu env đã được set và không trỏ vào localhost → dùng ngay
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/$/, ''); // xóa trailing slash nếu có
  }
  // Fallback: tự build từ headers của request (hoạt động trên render.com, Railway, v.v.)
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}

// ─────────────────────────────────────────────
// HELPER: Lấy IP thực của request
// (hỗ trợ proxy/load balancer qua x-forwarded-for)
// ─────────────────────────────────────────────
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
}

// ─────────────────────────────────────────────
// ĐĂNG KÝ – POST /api/auth/register
// ─────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password, recaptcha_token } = req.body;

  // 1. Xác thực reCAPTCHA
  const captchaOk = await verifyRecaptcha(recaptcha_token);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Xác thực reCAPTCHA thất bại. Vui lòng thử lại.' });
  }

  // 2. Validate input
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
  }

  const ip = getClientIp(req);

  try {
    // 2. Kiểm tra IP đã đăng ký tài khoản chưa
    const existingIp = db
      .prepare('SELECT id FROM users WHERE ip_address = ?')
      .get(ip);
    if (existingIp) {
      return res
        .status(409)
        .json({ error: 'Địa chỉ IP này đã được dùng để đăng ký tài khoản.' });
    }

    // 3. Kiểm tra email đã tồn tại chưa
    const existingEmail = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);
    if (existingEmail) {
      return res
        .status(409)
        .json({ error: 'Email này đã được đăng ký. Vui lòng dùng email khác.' });
    }

    // 4. Hash mật khẩu (bcrypt, salt rounds = 12)
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Kiểm tra có phải user đầu tiên không → cấp quyền admin
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get();
    const role = totalUsers.c === 0 ? 'admin' : 'reader';

    // 6. Tạo user mới
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, ip_address, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insertUser.run(name, email.toLowerCase(), passwordHash, ip, role);
    const userId = result.lastInsertRowid;

    // 7. Tạo token xác thực email (UUID, có hiệu lực 24h)
    const token     = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO email_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(userId, token, expiresAt);

    // 8. Gửi email xác thực (await để biết kết quả)
    const baseUrl = getBaseUrl(req);
    let emailSent = false;
    try {
      const emailResult = await sendVerificationEmail(email, name, token, baseUrl);
      emailSent = emailResult.success;
      if (!emailSent) {
        console.error(`[Auth] Gửi email xác thực thất bại cho ${email}:`, emailResult.error);
      }
    } catch (err) {
      console.error('[Auth] Exception khi gửi email:', err.message);
    }

    console.log(`[Auth] Đăng ký thành công: ${email} (IP: ${ip}, Role: ${role}, Email sent: ${emailSent})`);

    return res.status(201).json({
      message: emailSent
        ? 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.'
        : 'Đăng ký thành công! Tuy nhiên không thể gửi email xác thực. Vui lòng liên hệ admin.',
      emailSent,
      isFirstAdmin: role === 'admin',
    });
  } catch (err) {
    console.error('[Auth] Lỗi đăng ký:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  }
}

// ─────────────────────────────────────────────
// ĐĂNG NHẬP – POST /api/auth/login
// ─────────────────────────────────────────────
async function login(req, res) {
  const { email, password, recaptcha_token } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
  }

  // Xác thực reCAPTCHA
  const captchaOk = await verifyRecaptcha(recaptcha_token);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Xác thực reCAPTCHA thất bại. Vui lòng thử lại.' });
  }

  try {
    // 1. Tìm user theo email
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    // 2. So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    // 3. Kiểm tra đã xác thực email chưa
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn.',
        needsVerification: true,
      });
    }

    // 4. Tạo session
    req.session.userId   = user.id;
    req.session.userName = user.name;
    req.session.userRole = user.role;

    console.log(`[Auth] Đăng nhập: ${user.email} (Role: ${user.role})`);

    return res.json({
      message: 'Đăng nhập thành công!',
      user: {
        id:   user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Auth] Lỗi đăng nhập:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  }
}

// ─────────────────────────────────────────────
// ĐĂNG XUẤT – POST /api/auth/logout
// ─────────────────────────────────────────────
function logout(req, res) {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Không thể đăng xuất.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Đã đăng xuất thành công.' });
  });
}

// ─────────────────────────────────────────────
// XÁC THỰC EMAIL – GET /api/auth/verify/:token
// ─────────────────────────────────────────────
function verifyEmail(req, res) {
  const { token } = req.params;

  try {
    // 1. Tìm token trong DB
    const record = db
      .prepare('SELECT * FROM email_tokens WHERE token = ?')
      .get(token);

    if (!record) {
      return res.redirect('/verify-email?status=invalid');
    }

    // 2. Kiểm tra token hết hạn
    if (new Date(record.expires_at) < new Date()) {
      db.prepare('DELETE FROM email_tokens WHERE id = ?').run(record.id);
      return res.redirect('/verify-email?status=expired');
    }

    // 3. Cập nhật trạng thái xác thực
    db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(record.user_id);

    // 4. Xóa token đã dùng
    db.prepare('DELETE FROM email_tokens WHERE id = ?').run(record.id);

    console.log(`[Auth] Xác thực email thành công cho user_id: ${record.user_id}`);
    return res.redirect('/verify-email?status=success');
  } catch (err) {
    console.error('[Auth] Lỗi xác thực email:', err);
    return res.redirect('/verify-email?status=error');
  }
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Kiểm tra đã đăng nhập
// ─────────────────────────────────────────────
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
}

// ─────────────────────────────────────────────
// MIDDLEWARE: Kiểm tra quyền theo role
// Dùng: requireRole('editor') hoặc requireRole('admin')
// ─────────────────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Bạn cần đăng nhập.' });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return next();
  };
}

// ─────────────────────────────────────────────
// QUÊN MẬT KHẨU – POST /api/auth/forgot-password
// Gửi email chứa link đặt lại mật khẩu (hết hạn sau 1 giờ)
// ─────────────────────────────────────────────
async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email.' });
  }

  try {
    // Tìm user theo email
    const user = db
      .prepare('SELECT id, name, email FROM users WHERE email = ?')
      .get(email.toLowerCase());

    // Bảo mật: luôn trả về thành công dù email có tồn tại hay không
    // (tránh leak thông tin tài khoản)
    if (!user) {
      console.log(`[Auth] Quên mật khẩu: email không tồn tại: ${email}`);
      return res.json({ message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn trong vài phút.' });
    }

    // Xóa token cũ của user này (nếu có)
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    // Tạo token mới (UUID), hết hạn sau 1 giờ
    const token     = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt);

    // Gửi email
    const baseUrl = getBaseUrl(req);
    let emailSent = false;
    try {
      const emailResult = await sendPasswordResetEmail(user.email, user.name, token, baseUrl);
      emailSent = emailResult.success;
      if (!emailSent) {
        console.error(`[Auth] Gửi email reset thất bại cho ${user.email}:`, emailResult.error);
      }
    } catch (err) {
      console.error('[Auth] Exception khi gửi email reset:', err.message);
    }

    console.log(`[Auth] Quên mật khẩu: đã gửi link reset cho ${user.email}`);
    return res.json({ message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn trong vài phút.' });
  } catch (err) {
    console.error('[Auth] Lỗi quên mật khẩu:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  }
}

// ─────────────────────────────────────────────
// ĐẶT LẠI MẬT KHẨU – POST /api/auth/reset-password
// Xác thực token và cập nhật mật khẩu mới
// ─────────────────────────────────────────────
async function resetPassword(req, res) {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  try {
    // Kiểm tra token tồn tại
    const record = db
      .prepare('SELECT * FROM password_reset_tokens WHERE token = ?')
      .get(token);

    if (!record) {
      return res.status(400).json({ error: 'Link đặt lại mật khẩu không hợp lệ.' });
    }

    // Kiểm tra hết hạn
    if (new Date(record.expires_at) < new Date()) {
      db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(record.id);
      return res.status(400).json({ error: 'Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.' });
    }

    // Hash mật khẩu mới
    const passwordHash = await bcrypt.hash(password, 12);

    // Cập nhật mật khẩu
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, record.user_id);

    // Xóa token đã dùng
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(record.id);

    console.log(`[Auth] Đặt lại mật khẩu thành công cho user_id: ${record.user_id}`);
    return res.json({ message: 'Mật khẩu đã được đặt lại thành công!' });
  } catch (err) {
    console.error('[Auth] Lỗi đặt lại mật khẩu:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại sau.' });
  }
}

// ─────────────────────────────────────────────
// API: Lấy thông tin user hiện tại
// GET /api/auth/me
// ─────────────────────────────────────────────
function getMe(req, res) {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }
  return res.json({
    user: {
      id:   req.session.userId,
      name: req.session.userName,
      role: req.session.userRole,
    },
  });
}

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  isAuthenticated,
  requireRole,
  getMe,
};
