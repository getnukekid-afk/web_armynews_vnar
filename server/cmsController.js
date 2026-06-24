// =============================================
// cmsController.js – Quản lý Nội dung Bài báo
// =============================================
// Dành cho Editor và Admin: tạo, sửa, xóa, publish bài

const db = require('./dbConfig');

// ─────────────────────────────────────────────
// Lấy danh sách bài của mình (Editor) hoặc tất cả (Admin)
// GET /api/cms/articles
// ─────────────────────────────────────────────
function getCmsArticles(req, res) {
  const userId = req.session.userId;
  const role   = req.session.userRole;

  try {
    let articles;
    if (role === 'admin') {
      // Admin thấy tất cả bài của mọi người
      articles = db.prepare(`
        SELECT a.id, a.title, a.status, a.published_at, a.created_at, a.updated_at,
               u.name as author_name, c.name as category_name
        FROM articles a
        JOIN users u           ON a.author_id   = u.id
        LEFT JOIN categories c ON a.category_id = c.id
        ORDER BY a.updated_at DESC
      `).all();
    } else {
      // Editor chỉ thấy bài của mình
      articles = db.prepare(`
        SELECT a.id, a.title, a.status, a.published_at, a.created_at, a.updated_at,
               u.name as author_name, c.name as category_name
        FROM articles a
        JOIN users u           ON a.author_id   = u.id
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.author_id = ?
        ORDER BY a.updated_at DESC
      `).all(userId);
    }

    return res.json({ articles });
  } catch (err) {
    console.error('[CMS] Lỗi lấy danh sách bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Lấy chi tiết 1 bài (kể cả draft) để chỉnh sửa
// GET /api/cms/articles/:id
// ─────────────────────────────────────────────
function getCmsArticleById(req, res) {
  const { id }  = req.params;
  const userId  = req.session.userId;
  const role    = req.session.userRole;

  try {
    const article = db.prepare(`
      SELECT * FROM articles WHERE id = ?
    `).get(id);

    if (!article) {
      return res.status(404).json({ error: 'Không tìm thấy bài báo.' });
    }
    // Editor chỉ được xem bài của mình
    if (role !== 'admin' && article.author_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem bài này.' });
    }

    return res.json({ article });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Tạo bài báo mới
// POST /api/cms/articles
// ─────────────────────────────────────────────
function createArticle(req, res) {
  const { title, category_id, summary, content, image_url } = req.body;
  const authorId = req.session.userId;

  if (!title || !content) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung không được để trống.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO articles (title, category_id, summary, content, image_url, author_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      title.trim(),
      category_id || null,
      summary ? summary.trim() : null,
      content.trim(),
      image_url ? image_url.trim() : null,
      authorId
    );

    console.log(`[CMS] Tạo bài mới ID=${result.lastInsertRowid} bởi user_id=${authorId}`);

    return res.status(201).json({
      message: 'Đã tạo bài báo thành công (ở chế độ Draft).',
      articleId: result.lastInsertRowid,
    });
  } catch (err) {
    console.error('[CMS] Lỗi tạo bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Cập nhật bài báo
// PUT /api/cms/articles/:id
// ─────────────────────────────────────────────
function updateArticle(req, res) {
  const { id }  = req.params;
  const userId  = req.session.userId;
  const role    = req.session.userRole;
  const { title, category_id, summary, content, image_url } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Tiêu đề và nội dung không được để trống.' });
  }

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) {
      return res.status(404).json({ error: 'Không tìm thấy bài báo.' });
    }
    if (role !== 'admin' && article.author_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền sửa bài này.' });
    }

    db.prepare(`
      UPDATE articles
      SET title = ?, category_id = ?, summary = ?, content = ?,
          image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title.trim(),
      category_id || null,
      summary ? summary.trim() : null,
      content.trim(),
      image_url ? image_url.trim() : null,
      id
    );

    return res.json({ message: 'Đã cập nhật bài báo thành công.' });
  } catch (err) {
    console.error('[CMS] Lỗi cập nhật bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Xóa bài báo
// DELETE /api/cms/articles/:id
// ─────────────────────────────────────────────
function deleteArticle(req, res) {
  const { id } = req.params;
  const userId = req.session.userId;
  const role   = req.session.userRole;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) {
      return res.status(404).json({ error: 'Không tìm thấy bài báo.' });
    }
    if (role !== 'admin' && article.author_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa bài này.' });
    }

    db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    console.log(`[CMS] Đã xóa bài ID=${id} bởi user_id=${userId}`);
    return res.json({ message: 'Đã xóa bài báo.' });
  } catch (err) {
    console.error('[CMS] Lỗi xóa bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Publish / Unpublish bài báo
// PUT /api/cms/articles/:id/publish
// ─────────────────────────────────────────────
function togglePublish(req, res) {
  const { id } = req.params;
  const userId = req.session.userId;
  const role   = req.session.userRole;

  try {
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    if (!article) {
      return res.status(404).json({ error: 'Không tìm thấy bài báo.' });
    }
    if (role !== 'admin' && article.author_id !== userId) {
      return res.status(403).json({ error: 'Bạn không có quyền thao tác bài này.' });
    }

    // Toggle trạng thái
    const newStatus     = article.status === 'published' ? 'draft' : 'published';
    const publishedAt   = newStatus === 'published' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE articles
      SET status = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, publishedAt, id);

    const statusLabel = newStatus === 'published' ? 'Đã đăng' : 'Chuyển về Draft';
    console.log(`[CMS] Toggle publish: ID=${id} → ${newStatus} bởi user_id=${userId}`);
    return res.json({ message: `${statusLabel} thành công.`, newStatus });
  } catch (err) {
    console.error('[CMS] Lỗi toggle publish:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

module.exports = {
  getCmsArticles,
  getCmsArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  togglePublish,
};
