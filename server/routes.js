// =============================================
// routes.js – Định nghĩa tất cả API Routes
// =============================================

const express = require('express');
const path    = require('path');
const router  = express.Router();

const auth  = require('./authController');
const news  = require('./newsController');
const cms   = require('./cmsController');
const admin = require('./adminController');

// ═══════════════════════════════════════════
// CONFIG ROUTE – Trả về cấu hình public cho frontend
// ═══════════════════════════════════════════
router.get('/api/config', (req, res) => {
  res.json({
    recaptcha_site_key: process.env.RECAPTCHA_SITE_KEY || '',
  });
});

// ═══════════════════════════════════════════
// EMAIL DIAGNOSTICS – Chỉ admin, dùng để debug
// GET /api/admin/test-smtp?to=email@example.com
// ═══════════════════════════════════════════
router.get('/api/admin/test-smtp', auth.requireRole('admin'), async (req, res) => {
  const { diagnoseSmtp, sendMail } = require('./emailService');
  const toEmail = req.query.to;

  // Bước 1: Chẩn đoán transport
  const diagnosis = await diagnoseSmtp();

  // Bước 2: Nếu có ?to= và transport sẵn sàng → gửi test email
  let sendResult = null;
  if (toEmail && diagnosis.verifyResult?.success) {
    const now = new Date().toISOString();
    sendResult = await sendMail({
      to:      toEmail,
      subject: 'Test Email – Army News VNAR',
      html:    `<h2>Test Email</h2><p>Gửi lúc: ${now}</p><p>Transport: ${diagnosis.transport}</p>`,
    });
  }

  return res.json({
    diagnosis,
    sendResult: sendResult || (toEmail ? 'Không gửi vì transport chưa sẵn sàng' : 'Thêm ?to=email để gửi test'),
    tips: !diagnosis.verifyResult?.success ? [
      'Trên Render.com: set BREVO_API_KEY trong Environment Variables',
      'Đăng ký Brevo miễn phí: https://app.brevo.com/account/register',
      'Lấy API key: https://app.brevo.com/settings/keys/api',
      'Verify sender email (SMTP_USER) trong Brevo → Settings → Senders',
    ] : [],
  });
});

// ═══════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════
router.post('/api/auth/register', auth.register);
router.post('/api/auth/login',    auth.login);

router.post('/api/auth/logout',   auth.logout);
router.get('/api/auth/verify/:token', auth.verifyEmail);
router.get('/api/auth/me',        auth.getMe);
router.post('/api/auth/forgot-password', auth.forgotPassword);
router.post('/api/auth/reset-password',  auth.resetPassword);

// ═══════════════════════════════════════════
// NEWS ROUTES – Yêu cầu đăng nhập
// ═══════════════════════════════════════════
router.get('/api/news/categories',   news.getCategories);
router.get('/api/news',              auth.isAuthenticated, news.getArticles);
router.get('/api/news/:id',          auth.isAuthenticated, news.getArticleById);

// ═══════════════════════════════════════════
// CMS ROUTES – Yêu cầu role editor hoặc admin
// ═══════════════════════════════════════════
router.get('/api/cms/articles',
  auth.requireRole('editor', 'admin'),
  cms.getCmsArticles
);
router.get('/api/cms/articles/:id',
  auth.requireRole('editor', 'admin'),
  cms.getCmsArticleById
);
router.post('/api/cms/articles',
  auth.requireRole('editor', 'admin'),
  cms.createArticle
);
router.put('/api/cms/articles/:id',
  auth.requireRole('editor', 'admin'),
  cms.updateArticle
);
router.delete('/api/cms/articles/:id',
  auth.requireRole('editor', 'admin'),
  cms.deleteArticle
);
router.put('/api/cms/articles/:id/publish',
  auth.requireRole('editor', 'admin'),
  cms.togglePublish
);

// ═══════════════════════════════════════════
// ADMIN ROUTES – Chỉ dành cho admin
// ═══════════════════════════════════════════
router.get('/api/admin/stats',
  auth.requireRole('admin'),
  admin.getStats
);
router.get('/api/admin/users',
  auth.requireRole('admin'),
  admin.listUsers
);
router.put('/api/admin/users/:id/role',
  auth.requireRole('admin'),
  admin.changeUserRole
);
router.delete('/api/admin/users/:id',
  auth.requireRole('admin'),
  admin.deleteUser
);

// ═══════════════════════════════════════════
// PAGE ROUTES – Serve HTML files
// ═══════════════════════════════════════════
const viewsDir = path.join(__dirname, '..', 'views');

// Trang chủ: redirect về login nếu chưa đăng nhập
router.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.sendFile(path.join(viewsDir, 'index.html'));
  }
  return res.redirect('/login');
});

router.get('/login',        (req, res) => res.sendFile(path.join(viewsDir, 'login.html')));
router.get('/register',     (req, res) => res.sendFile(path.join(viewsDir, 'register.html')));
router.get('/verify-email', (req, res) => res.sendFile(path.join(viewsDir, 'verify-email.html')));
router.get('/reset-password', (req, res) => res.sendFile(path.join(viewsDir, 'reset-password.html')));

// Trang đọc bài – yêu cầu đăng nhập
router.get('/article/:id', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  return res.sendFile(path.join(viewsDir, 'article.html'));
});

// Trang CMS – yêu cầu editor/admin
router.get('/cms', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  if (!['editor', 'admin'].includes(req.session.userRole)) return res.redirect('/');
  return res.sendFile(path.join(viewsDir, 'cms.html'));
});

// Trang Admin – yêu cầu admin
router.get('/admin', (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/login');
  if (req.session.userRole !== 'admin') return res.redirect('/');
  return res.sendFile(path.join(viewsDir, 'admin.html'));
});

module.exports = router;
