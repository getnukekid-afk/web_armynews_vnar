// =============================================
// adminController.js – Quản lý Người dùng (Admin)
// =============================================
// Chỉ dành cho tài khoản có role = 'admin'

const db = require('./dbConfig');

// ─────────────────────────────────────────────
// Lấy danh sách tất cả users
// GET /api/admin/users
// ─────────────────────────────────────────────
function listUsers(req, res) {
  try {
    const users = db.prepare(`
      SELECT id, name, email, ip_address, is_verified, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();

    return res.json({ users });
  } catch (err) {
    console.error('[Admin] Lỗi lấy danh sách users:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Thay đổi role của một user
// PUT /api/admin/users/:id/role
// Body: { role: 'reader' | 'editor' | 'admin' }
// ─────────────────────────────────────────────
function changeUserRole(req, res) {
  const { id }   = req.params;
  const { role } = req.body;
  const adminId  = req.session.userId;

  // Validate role hợp lệ
  const validRoles = ['reader', 'editor', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Role không hợp lệ.' });
  }

  // Không cho phép admin tự hạ cấp mình
  if (parseInt(id) === adminId) {
    return res.status(400).json({ error: 'Bạn không thể thay đổi role của chính mình.' });
  }

  try {
    const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);

    console.log(`[Admin] Thay đổi role: user_id=${id} (${user.email}) → ${role} bởi admin_id=${adminId}`);

    return res.json({
      message: `Đã cập nhật quyền của ${user.email} thành ${role}.`,
    });
  } catch (err) {
    console.error('[Admin] Lỗi thay đổi role:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Xóa tài khoản người dùng
// DELETE /api/admin/users/:id
// ─────────────────────────────────────────────
function deleteUser(req, res) {
  const { id }  = req.params;
  const adminId = req.session.userId;

  if (parseInt(id) === adminId) {
    return res.status(400).json({ error: 'Bạn không thể xóa tài khoản của chính mình.' });
  }

  try {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    console.log(`[Admin] Đã xóa user_id=${id} (${user.email}) bởi admin_id=${adminId}`);
    return res.json({ message: `Đã xóa tài khoản ${user.email}.` });
  } catch (err) {
    console.error('[Admin] Lỗi xóa user:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Thống kê tổng quan
// GET /api/admin/stats
// ─────────────────────────────────────────────
function getStats(req, res) {
  try {
    const totalUsers     = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const verifiedUsers  = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_verified = 1').get().c;
    const totalArticles  = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
    const publishedArticles = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'published'").get().c;
    const totalEditors   = db.prepare("SELECT COUNT(*) as c FROM users WHERE role IN ('editor','admin')").get().c;

    return res.json({
      stats: {
        totalUsers,
        verifiedUsers,
        totalArticles,
        publishedArticles,
        totalEditors,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

module.exports = { listUsers, changeUserRole, deleteUser, getStats };
