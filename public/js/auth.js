// =============================================
// auth.js – Logic Frontend cho Login & Register
// =============================================
// Google reCAPTCHA v2, form validation, API calls

// ─── GOOGLE reCAPTCHA ────────────────────────
let recaptchaWidgetId = null;

/**
 * Khởi tạo Google reCAPTCHA v2.
 * Fetch site key từ /api/config, load script, render widget vào #recaptcha-container.
 */
async function initRecaptcha() {
  try {
    const res     = await fetch('/api/config');
    const data    = await res.json();
    const siteKey = data.recaptcha_site_key;

    if (!siteKey) {
      console.warn('[reCAPTCHA] RECAPTCHA_SITE_KEY chưa được cấu hình.');
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '<span style="color:var(--color-gray-400);font-size:var(--text-sm);">reCAPTCHA chưa được cấu hình.</span>';
      }
      return;
    }

    // Hàm render widget (gọi sau khi grecaptcha đã sẵn sàng)
    const renderWidget = () => {
      const container = document.getElementById('recaptcha-container');
      if (!container || recaptchaWidgetId !== null) return;
      recaptchaWidgetId = grecaptcha.render(container, {
        sitekey: siteKey,
        theme:   'light',
      });
    };

    // Nếu grecaptcha đã load rồi thì render ngay
    if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
      renderWidget();
      return;
    }

    // Load script động với callback
    window._recaptchaOnLoad = renderWidget;
    const script   = document.createElement('script');
    script.src     = 'https://www.google.com/recaptcha/api.js?onload=_recaptchaOnLoad&render=explicit';
    script.async   = true;
    script.defer   = true;
    script.onerror = () => {
      console.error('[reCAPTCHA] Không thể tải script. Kiểm tra kết nối mạng.');
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '<span style="color:#e74c3c;font-size:var(--text-sm);">Không thể tải reCAPTCHA. Kiểm tra kết nối mạng.</span>';
      }
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error('[reCAPTCHA] Lỗi khởi tạo:', err);
  }
}

/**
 * Lấy token reCAPTCHA hiện tại.
 * @returns {string} Token hoặc chuỗi rỗng nếu chưa check
 */
function getRecaptchaToken() {
  if (recaptchaWidgetId === null || typeof grecaptcha === 'undefined') return '';
  return grecaptcha.getResponse(recaptchaWidgetId) || '';
}

/**
 * Reset widget reCAPTCHA sau khi submit thất bại.
 */
function resetRecaptcha() {
  if (recaptchaWidgetId !== null && typeof grecaptcha !== 'undefined') {
    grecaptcha.reset(recaptchaWidgetId);
  }
}

// ─── HELPERS ────────────────────────────────
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  const fieldId = id.replace('-error', '');
  const field   = document.getElementById(fieldId);
  if (field) field.classList.add('error');
}

function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
  const fieldId = id.replace('-error', '');
  const field   = document.getElementById(fieldId);
  if (field) field.classList.remove('error');
}

function clearAllErrors() {
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error'));
}

function showAlert(msg, type = 'error') {
  const box    = document.getElementById('alert-box');
  const textEl = document.getElementById('alert-text');
  const iconEl = document.getElementById('alert-icon');
  if (!box || !textEl) return;

  const icons   = { error: '⚠️', success: '✅', warning: '⚡' };
  const classes = { error: 'alert-error', success: 'alert-success', warning: 'alert-warning' };

  box.className = `alert ${classes[type] || 'alert-error'}`;
  if (iconEl) iconEl.textContent = icons[type] || '⚠️';
  textEl.textContent = msg;
  box.style.display  = 'flex';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  const box = document.getElementById('alert-box');
  if (box) box.style.display = 'none';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px;"></span>Đang xử lý...';
  } else {
    btn.disabled     = false;
    btn.textContent  = btn.dataset.originalText || btn.textContent;
  }
}

// ─── ĐĂNG NHẬP ──────────────────────────────
async function handleLogin() {
  clearAllErrors();
  hideAlert();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Validate cơ bản
  let valid = true;
  if (!email)    { showFieldError('email-error',    'Vui lòng nhập email.');      valid = false; }
  if (!password) { showFieldError('password-error', 'Vui lòng nhập mật khẩu.'); valid = false; }
  if (!valid) return;

  // Validate reCAPTCHA
  const recaptchaToken = getRecaptchaToken();
  if (!recaptchaToken) {
    showFieldError('captcha-error', 'Vui lòng xác nhận bạn không phải robot.');
    return;
  }
  clearFieldError('captcha-error');

  setLoading('submit-btn', true);

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, recaptcha_token: recaptchaToken }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Đăng nhập thất bại.', 'error');
      resetRecaptcha();
    } else {
      showAlert('Đăng nhập thành công! Đang chuyển hướng...', 'success');
      setTimeout(() => { window.location.href = '/'; }, 800);
    }
  } catch {
    showAlert('Lỗi kết nối. Vui lòng thử lại.', 'error');
    resetRecaptcha();
  } finally {
    setLoading('submit-btn', false);
  }
}

// ─── QUÊN MẬT KHẨU (MODAL) ──────────────────
function openForgotModal() {
  const modal = document.getElementById('forgot-modal');
  if (!modal) return;
  // Reset trạng thái modal
  document.getElementById('forgot-email').value  = '';
  document.getElementById('forgot-email-error').textContent = '';
  document.getElementById('forgot-email').classList.remove('error');
  document.getElementById('forgot-alert').style.display = 'none';
  document.getElementById('forgot-submit-btn').disabled  = false;
  document.getElementById('forgot-submit-btn').textContent = 'Gửi email';
  document.getElementById('forgot-email').readOnly = false;
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('forgot-email').focus(), 100);
}

function closeForgotModal() {
  const modal = document.getElementById('forgot-modal');
  if (modal) modal.style.display = 'none';
}

async function handleForgotPassword() {
  const emailEl    = document.getElementById('forgot-email');
  const emailErrEl = document.getElementById('forgot-email-error');
  const alertEl    = document.getElementById('forgot-alert');
  const alertIconEl = document.getElementById('forgot-alert-icon');
  const alertTextEl = document.getElementById('forgot-alert-text');
  const submitBtn  = document.getElementById('forgot-submit-btn');

  // Reset errors
  emailErrEl.textContent = '';
  emailEl.classList.remove('error');
  alertEl.style.display  = 'none';

  const email = emailEl.value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailErrEl.textContent = 'Vui lòng nhập địa chỉ email hợp lệ.';
    emailEl.classList.add('error');
    emailEl.focus();
    return;
  }

  // Loading state
  submitBtn.disabled    = true;
  submitBtn.innerHTML   = '<span class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:6px;"></span>Đang gửi...';

  try {
    const res  = await fetch('/api/auth/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Lỗi server
      alertEl.className      = 'alert alert-error';
      alertIconEl.textContent = '⚠️';
      alertTextEl.textContent = data.error || 'Có lỗi xảy ra. Vui lòng thử lại.';
      alertEl.style.display  = 'flex';
      submitBtn.disabled     = false;
      submitBtn.textContent  = 'Gửi email';
    } else {
      // Thành công – hiện thông báo, khóa form
      alertEl.className      = 'alert alert-success';
      alertIconEl.textContent = '✅';
      alertTextEl.textContent = data.message;
      alertEl.style.display  = 'flex';
      emailEl.readOnly       = true;
      submitBtn.textContent  = '✅ Đã gửi';
    }
  } catch {
    alertEl.className      = 'alert alert-error';
    alertIconEl.textContent = '⚠️';
    alertTextEl.textContent = 'Lỗi kết nối. Vui lòng thử lại.';
    alertEl.style.display  = 'flex';
    submitBtn.disabled     = false;
    submitBtn.textContent  = 'Gửi email';
  }
}

// Đóng modal khi nhấn Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeForgotModal();
});
// ─── ĐĂNG KÝ ────────────────────────────────
async function handleRegister() {
  clearAllErrors();
  hideAlert();

  const name    = document.getElementById('name').value.trim();
  const email   = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('confirm-password').value;

  // Validate
  let valid = true;
  if (!name || name.length < 2) {
    showFieldError('name-error', 'Họ tên phải có ít nhất 2 ký tự.'); valid = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email-error', 'Email không hợp lệ.'); valid = false;
  }
  if (!password || password.length < 6) {
    showFieldError('password-error', 'Mật khẩu phải có ít nhất 6 ký tự.'); valid = false;
  }
  if (password !== confirm) {
    showFieldError('confirm-password-error', 'Mật khẩu xác nhận không khớp.'); valid = false;
  }
  if (!valid) return;

  // Validate reCAPTCHA
  const recaptchaToken = getRecaptchaToken();
  if (!recaptchaToken) {
    showFieldError('captcha-error', 'Vui lòng xác nhận bạn không phải robot.');
    return;
  }
  clearFieldError('captcha-error');

  setLoading('submit-btn', true);

  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password, recaptcha_token: recaptchaToken }),
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Đăng ký thất bại.', 'error');
      resetRecaptcha();
    } else {
      document.getElementById('register-form').style.display = 'none';
      showAlert(
        data.message || 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
        'success'
      );
      if (data.isFirstAdmin) {
        setTimeout(() => {
          showAlert('🎉 Bạn là người dùng đầu tiên – tài khoản được cấp quyền Admin!', 'success');
        }, 500);
      }
    }
  } catch {
    showAlert('Lỗi kết nối. Vui lòng thử lại.', 'error');
    resetRecaptcha();
  } finally {
    setLoading('submit-btn', false);
  }
}
