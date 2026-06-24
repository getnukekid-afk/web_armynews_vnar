// =============================================
// admin.js – Logic Dashboard Quản trị Hệ thống
// =============================================
// Dành cho trang /admin (Admin only)

let deleteUserTargetId = null;

// ─── KHỞI TẠO TRANG ADMIN ───────────────────
async function initAdminPage() {
  // Kiểm tra auth và quyền admin
  const user = await fetchCurrentUser();
  if (!user) return;

  if (user.role !== 'admin') {
    showToast('Từ chối truy cập', 'Bạn không có quyền Admin.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 1500);
    return;
  }

  // Cập nhật user info
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = user.name;

  // Load stats và users song song
  await Promise.all([loadStats(), loadUsers()]);

  // Setup confirm delete modal
  const confirmBtn = document.getElementById('confirm-delete-user-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      document.getElementById('delete-user-modal').style.display = 'none';
      await executeDeleteUser(deleteUserTargetId);
    };
  }
}

// ─── LOAD THỐNG KÊ ───────────────────────────
async function loadStats() {
  try {
    const res  = await fetch('/api/admin/stats');
    const data = await res.json();
    const s    = data.stats;

    setText('stat-users',     s.totalUsers);
    setText('stat-verified',  s.verifiedUsers);
    setText('stat-articles',  s.totalArticles);
    setText('stat-published', s.publishedArticles);
    setText('stat-editors',   s.totalEditors);
  } catch (err) {
    console.error('[Admin] Lỗi load stats:', err);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

// ─── LOAD DANH SÁCH USERS ────────────────────
async function loadUsers() {
  const loading   = document.getElementById('users-loading');
  const tableWrap = document.getElementById('users-table-container');
  const emptyEl   = document.getElementById('users-empty');
  const alertEl   = document.getElementById('admin-alert');

  if (loading)   loading.style.display   = 'block';
  if (tableWrap) tableWrap.style.display = 'none';
  if (emptyEl)   emptyEl.style.display   = 'none';
  if (alertEl)   alertEl.style.display   = 'none';

  try {
    const res  = await fetch('/api/admin/users');
    const data = await res.json();
    const users = data.users || [];

    if (loading) loading.style.display = 'none';

    if (users.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
    renderUsersTable(users);

  } catch {
    if (loading) loading.style.display = 'none';
    showToast('Lỗi', 'Không thể tải danh sách người dùng.', 'error');
  }
}

// ─── RENDER BẢNG USERS ───────────────────────
function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  tbody.innerHTML = users.map((u, idx) => {
    const verifiedBadge = u.is_verified
      ? `<span class="badge badge-success">✅ Đã xác thực</span>`
      : `<span class="badge badge-warning">⏳ Chờ xác thực</span>`;

    const roleBadges = {
      reader: `<span class="badge badge-gray">👤 Độc giả</span>`,
      editor: `<span class="badge badge-primary">✍️ Editor</span>`,
      admin:  `<span class="badge badge-danger">⚙️ Admin</span>`,
    };
    const roleBadge = roleBadges[u.role] || `<span class="badge">${u.role}</span>`;

    const createdDate = u.created_at
      ? new Date(u.created_at).toLocaleDateString('vi-VN')
      : '—';

    // Tạo nút thay đổi role
    const roleOptions = ['reader', 'editor', 'admin'].filter(r => r !== u.role);
    const roleButtons = roleOptions.map(r => {
      const labels = { reader: '👤 Hạ Độc giả', editor: '✍️ Cấp Editor', admin: '⚙️ Cấp Admin' };
      const classes = { reader: 'btn-ghost', editor: 'btn-outline', admin: 'btn-danger' };
      return `<button class="btn ${classes[r]} btn-sm" onclick="changeRole(${u.id}, '${r}', '${u.email}')">${labels[r]}</button>`;
    });

    return `
      <tr>
        <td style="color: var(--color-gray-400); font-size: var(--text-xs);">${idx + 1}</td>
        <td>
          <div style="font-weight:600; font-size: var(--text-sm);">${u.name}</div>
        </td>
        <td style="font-size: var(--text-sm);">${u.email}</td>
        <td>
          <span style="font-family: monospace; font-size: var(--text-xs); color: var(--color-gray-500);">
            ${u.ip_address || '—'}
          </span>
        </td>
        <td>${verifiedBadge}</td>
        <td>${roleBadge}</td>
        <td style="font-size: var(--text-xs); color: var(--color-gray-400); white-space: nowrap;">${createdDate}</td>
        <td>
          <div style="display:flex; gap: var(--space-2); flex-wrap:wrap; min-width:160px;">
            ${roleButtons.join('')}
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteUser(${u.id}, '${u.email}')">🗑️ Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── THAY ĐỔI ROLE ───────────────────────────
async function changeRole(userId, newRole, email) {
  const roleLabels = { reader: 'Độc giả', editor: 'Editor', admin: 'Admin' };
  const confirmed  = window.confirm(`Xác nhận thay đổi quyền của ${email} thành ${roleLabels[newRole]}?`);
  if (!confirmed) return;

  try {
    const res  = await fetch(`/api/admin/users/${userId}/role`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role: newRole }),
    });
    const data = await res.json();

    if (res.ok) {
      showToast('Thành công!', data.message, 'success');
      showAdminAlert(data.message, 'success');
      await Promise.all([loadUsers(), loadStats()]);
    } else {
      showToast('Lỗi', data.error || 'Thao tác thất bại.', 'error');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  }
}

// ─── XÓA USER ────────────────────────────────
function confirmDeleteUser(id, email) {
  deleteUserTargetId = id;
  const modal = document.getElementById('delete-user-modal');
  if (modal) {
    modal.style.display = 'flex';
    const desc = modal.querySelector('p');
    if (desc) {
      desc.innerHTML = `Bạn có chắc muốn xóa tài khoản <strong>${email}</strong>? Hành động này không thể hoàn tác.`;
    }
  }
}

async function executeDeleteUser(id) {
  try {
    const res  = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      showToast('Đã xóa', data.message, 'success');
      showAdminAlert(data.message, 'success');
      await Promise.all([loadUsers(), loadStats()]);
    } else {
      showToast('Lỗi', data.error || 'Không thể xóa.', 'error');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  }
}

// ─── HIỂN THỊ ALERT TRONG PANEL ──────────────
function showAdminAlert(msg, type = 'success') {
  const el    = document.getElementById('admin-alert');
  const iconEl = document.getElementById('admin-alert-icon');
  const textEl = document.getElementById('admin-alert-text');
  if (!el) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const classes = { success: 'alert-success', error: 'alert-error', warning: 'alert-warning' };

  el.className = `alert ${classes[type]}`;
  if (iconEl) iconEl.textContent = icons[type];
  if (textEl) textEl.textContent = msg;
  el.style.display = 'flex';

  setTimeout(() => { el.style.display = 'none'; }, 5000);
}
