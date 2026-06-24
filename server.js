// =============================================
// server.js – Entry Point cho Army News VNAR
// =============================================

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const FileStore  = require('session-file-store')(session);

const routes = require('./server/routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// Tin tưởng proxy (để lấy IP thực)
app.set('trust proxy', 1);

// ─── PARSE BODY ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── RATE LIMITING ────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message: { error: 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.' },
});
app.use(globalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── SESSION (lưu vào file, không cần DB native) ──
app.use(session({
  store: new FileStore({
    path:    './sessions',   // thư mục lưu file session
    ttl:     7 * 24 * 60 * 60, // 7 ngày (giây)
    retries: 0,
    logFn:   () => {},       // tắt log verbose
  }),
  secret:            process.env.SESSION_SECRET || 'fallback_secret_change_me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,         // true khi dùng HTTPS
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// ─── STATIC FILES ─────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── ROUTES ───────────────────────────────────
app.use('/', routes);

// ─── 404 HANDLER ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Trang không tồn tại.' });
});

// ─── ERROR HANDLER ────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Lỗi máy chủ.' });
});

// ─── KHỞI ĐỘNG ────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════╗');
  console.log('  ║       ⚑  ARMY NEWS VNAR  ⚑           ║');
  console.log('  ║  Báo Điện Tử Quân Đội Nhân Dân VN    ║');
  console.log('  ╚═══════════════════════════════════════╝');
  console.log(`  🚀 Server đang chạy: http://localhost:${PORT}`);
  console.log(`  📅 Thời gian: ${new Date().toLocaleString('vi-VN')}`);
  console.log('');
});
