// =============================================
// newsController.js – Đọc Tin Tức (Public API)
// =============================================
// Chỉ trả về bài đã published cho người dùng đã đăng nhập

const db = require('./dbConfig');

// ─────────────────────────────────────────────
// Lấy danh sách bài báo đã published
// GET /api/news?page=1&limit=10&category=quan-su
// ─────────────────────────────────────────────
function getArticles(req, res) {
  const page     = Math.max(1, parseInt(req.query.page)  || 1);
  const limit    = Math.min(50, parseInt(req.query.limit) || 10);
  const offset   = (page - 1) * limit;
  const category = req.query.category || null; // slug của category

  try {
    let articles, total;

    if (category) {
      // Lọc theo danh mục
      total = db.prepare(`
        SELECT COUNT(*) as c FROM articles a
        JOIN categories c ON a.category_id = c.id
        WHERE a.status = 'published' AND c.slug = ?
      `).get(category).c;

      articles = db.prepare(`
        SELECT a.id, a.title, a.summary, a.image_url, a.published_at,
               u.name as author_name, c.name as category_name, c.slug as category_slug
        FROM articles a
        JOIN users u      ON a.author_id    = u.id
        JOIN categories c ON a.category_id  = c.id
        WHERE a.status = 'published' AND c.slug = ?
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `).all(category, limit, offset);
    } else {
      // Tất cả bài đã published
      total = db.prepare(
        "SELECT COUNT(*) as c FROM articles WHERE status = 'published'"
      ).get().c;

      articles = db.prepare(`
        SELECT a.id, a.title, a.summary, a.image_url, a.published_at,
               u.name as author_name, c.name as category_name, c.slug as category_slug
        FROM articles a
        JOIN users u      ON a.author_id    = u.id
        LEFT JOIN categories c ON a.category_id  = c.id
        WHERE a.status = 'published'
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);
    }

    return res.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[News] Lỗi lấy danh sách bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Lấy chi tiết 1 bài báo
// GET /api/news/:id
// ─────────────────────────────────────────────
function getArticleById(req, res) {
  const { id } = req.params;

  try {
    const article = db.prepare(`
      SELECT a.id, a.title, a.summary, a.content, a.image_url, a.published_at, a.author_id,
             u.name as author_name, c.name as category_name, c.slug as category_slug
      FROM articles a
      JOIN users u           ON a.author_id   = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = ? AND a.status = 'published'
    `).get(id);

    if (!article) {
      return res.status(404).json({ error: 'Không tìm thấy bài báo.' });
    }

    // Lấy 5 bài liên quan (cùng category, không phải bài hiện tại)
    const related = db.prepare(`
      SELECT a.id, a.title, a.summary, a.image_url, a.published_at,
             u.name as author_name
      FROM articles a
      JOIN users u ON a.author_id = u.id
      WHERE a.status = 'published' AND a.category_id = (
        SELECT category_id FROM articles WHERE id = ?
      ) AND a.id != ?
      ORDER BY a.published_at DESC
      LIMIT 5
    `).all(id, id);

    return res.json({ article, related });
  } catch (err) {
    console.error('[News] Lỗi lấy chi tiết bài:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

// ─────────────────────────────────────────────
// Lấy danh sách tất cả danh mục
// GET /api/news/categories
// ─────────────────────────────────────────────
function getCategories(req, res) {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
    return res.json({ categories });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}

module.exports = { getArticles, getArticleById, getCategories };
