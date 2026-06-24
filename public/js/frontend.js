// =============================================
// frontend.js – Logic UI Chung cho Trang Báo
// =============================================
// Toast notifications, hamburger menu,
// homepage render, article page render,
// logout, và utilities dùng chung

// ─── GLOBAL STATE ───────────────────────────
let currentUser = null; // { id, name, role }

// ─── TOAST NOTIFICATIONS ────────────────────
/**
 * Hiển thị thông báo toast
 * @param {string} title
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration - ms
 */
function showToast(title, message = '', type = 'success', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ─── HAMBURGER MENU ──────────────────────────
function toggleMenu() {
  const nav  = document.getElementById('header-nav');
  const btn  = document.getElementById('hamburger');
  if (!nav || !btn) return;
  nav.classList.toggle('open');
  btn.classList.toggle('open');
}

// Đóng menu khi click bên ngoài
document.addEventListener('click', (e) => {
  const nav = document.getElementById('header-nav');
  const btn = document.getElementById('hamburger');
  if (nav && btn && !nav.contains(e.target) && !btn.contains(e.target)) {
    nav.classList.remove('open');
    btn.classList.remove('open');
  }
});

// ─── ĐĂNG XUẤT ──────────────────────────────
async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } catch {
    window.location.href = '/login';
  }
}

// ─── LẤY THÔNG TIN USER HIỆN TẠI ────────────
async function fetchCurrentUser() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;

    if (!currentUser) {
      // Chưa đăng nhập → redirect về login
      window.location.href = '/login';
      return null;
    }

    // Cập nhật header UI
    const nameEl  = document.getElementById('user-name');
    const roleEl  = document.getElementById('user-role-badge');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (roleEl) {
      const roleLabels = { reader: 'Độc giả', editor: 'Editor', admin: 'Admin' };
      roleEl.textContent = roleLabels[currentUser.role] || currentUser.role;
      roleEl.className   = `header-user-role ${currentUser.role}`;
    }

    // Inject nút CMS / Admin nếu có quyền
    const cmsBtnSlot = document.getElementById('cms-btn-slot');
    if (cmsBtnSlot) {
      if (currentUser.role === 'editor' || currentUser.role === 'admin') {
        cmsBtnSlot.innerHTML = `<a href="/cms" class="btn btn-ghost btn-sm nav-link-cms">✏️ Viết bài</a>`;
      }
      if (currentUser.role === 'admin') {
        cmsBtnSlot.innerHTML += `<a href="/admin" class="btn btn-ghost btn-sm nav-link-admin">⚙️ Admin</a>`;
      }
    }

    return currentUser;
  } catch {
    window.location.href = '/login';
    return null;
  }
}

// ─── LẤY VÀ RENDER DANH MỤC ─────────────────
async function fetchAndRenderCategories() {
  try {
    const res  = await fetch('/api/news/categories');
    const data = await res.json();
    const cats = data.categories || [];

    // Navigation categories
    const navCats = document.getElementById('nav-categories');
    if (navCats) {
      navCats.innerHTML = cats.map(c =>
        `<a class="nav-link" href="/?category=${c.slug}" data-cat="${c.slug}">${c.name}</a>`
      ).join('');
    }

    // Footer categories
    const footerCats = document.getElementById('footer-categories');
    if (footerCats) {
      footerCats.innerHTML = cats.map(c =>
        `<a class="footer-link" href="/?category=${c.slug}">${c.name}</a>`
      ).join('');
    }

    // Sidebar categories
    const sidebarCats = document.getElementById('sidebar-categories');
    if (sidebarCats) {
      sidebarCats.innerHTML = cats.map(c =>
        `<a href="/?category=${c.slug}" style="display:flex; align-items:center; justify-content:space-between; padding: var(--space-2) 0; font-size: var(--text-sm); color: var(--color-gray-600); text-decoration: none; border-bottom: 1px solid var(--color-gray-100);">
          <span>${c.name}</span>
          <span style="color: var(--color-primary);">→</span>
        </a>`
      ).join('');
    }

    return cats;
  } catch { return []; }
}

// ─── FORMAT DATE ─────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

// ─── RENDER ARTICLE CARD ─────────────────────
function renderArticleCard(article) {
  const hasImg = article.image_url && article.image_url.trim();
  return `
    <div class="card animate-fadeInUp">
      <a href="/article/${article.id}">
        ${hasImg
          ? `<img class="card-img" src="${article.image_url}" alt="${article.title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div class="card-img-placeholder" style="display:none;">📰</div>`
          : `<div class="card-img-placeholder">📰</div>`
        }
      </a>
      <div class="card-body">
        ${article.category_name
          ? `<a href="/?category=${article.category_slug}" class="badge badge-primary" style="margin-bottom: var(--space-2); display:inline-block;">${article.category_name}</a>`
          : ''}
        <h3 class="card-title">
          <a href="/article/${article.id}">${article.title}</a>
        </h3>
        ${article.summary ? `<p class="card-summary">${article.summary}</p>` : ''}
        <div class="card-meta">
          <span class="card-author">✍️ ${article.author_name || 'Biên tập viên'}</span>
          <span class="card-date">${formatDate(article.published_at)}</span>
        </div>
      </div>
    </div>
  `;
}

// ─── RENDER SIDEBAR NEWS ITEM ─────────────────
function renderSidebarItem(article, index) {
  return `
    <a href="/article/${article.id}" class="sidebar-news-item">
      <span class="sidebar-news-num">${index + 1}</span>
      <span class="sidebar-news-title">${article.title}</span>
    </a>
  `;
}

// ─── TRANG CHỦ ───────────────────────────────
let currentPage     = 1;
let currentCategory = null;
let totalPages      = 1;

async function initHomePage() {
  // 1. Kiểm tra auth
  const user = await fetchCurrentUser();
  if (!user) return;

  // 2. Load categories
  await fetchAndRenderCategories();

  // 3. Đọc query params
  const params = new URLSearchParams(window.location.search);
  currentCategory = params.get('category') || null;
  currentPage     = parseInt(params.get('page')) || 1;

  // 4. Highlight active nav
  if (currentCategory) {
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.cat === currentCategory);
    });
  }

  // 5. Category filter bar
  renderCatFilterBar();

  // 6. Load bài báo
  await loadArticles(currentPage, currentCategory);
}

function renderCatFilterBar() {
  const bar = document.getElementById('cat-filter-bar');
  if (!bar) return;

  const catLinks = document.querySelectorAll('#nav-categories .nav-link');
  const btns = [`<button class="btn ${!currentCategory ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="filterByCategory(null)">🏠 Tất cả</button>`];
  catLinks.forEach(a => {
    const slug  = a.dataset.cat;
    const name  = a.textContent.trim();
    const active = slug === currentCategory;
    btns.push(`<button class="btn ${active ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="filterByCategory('${slug}')">${name}</button>`);
  });
  bar.innerHTML = btns.join('');
}

function filterByCategory(slug) {
  currentCategory = slug;
  currentPage     = 1;
  const url = slug ? `/?category=${slug}` : '/';
  window.history.pushState({}, '', url);
  loadArticles(1, slug);
}

async function loadArticles(page = 1, category = null) {
  // Hiển thị loading
  document.getElementById('loading-indicator').style.display = 'block';
  document.getElementById('home-content').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';

  try {
    const qs = new URLSearchParams({ page, limit: 9 });
    if (category) qs.set('category', category);

    const res  = await fetch(`/api/news?${qs}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    const articles = data.articles || [];
    totalPages     = data.pagination?.totalPages || 1;

    document.getElementById('loading-indicator').style.display = 'none';

    if (articles.length === 0) {
      document.getElementById('empty-state').style.display = 'block';
      return;
    }

    document.getElementById('home-content').style.display = 'block';

    // Featured article (bài đầu tiên, to nhất)
    renderFeaturedArticle(articles[0]);

    // Render grid (bài 1 → cuối)
    const grid = document.getElementById('articles-grid');
    if (grid) {
      grid.innerHTML = articles.slice(1).map(a => renderArticleCard(a)).join('');
    }

    // Sidebar: 5 bài đầu
    const sidebarList = document.getElementById('sidebar-latest');
    if (sidebarList) {
      sidebarList.innerHTML = articles.slice(0, 5).map((a, i) => renderSidebarItem(a, i)).join('');
    }

    // Breaking news ticker (3 title đầu)
    const tickerText = document.getElementById('breaking-ticker-text');
    const breakingBar = document.getElementById('breaking-bar');
    if (tickerText && articles.length > 0) {
      tickerText.textContent = articles.slice(0, 3).map(a => `📌 ${a.title}`).join('   ⬥   ');
      if (breakingBar) breakingBar.style.display = 'block';
    }

    // Pagination
    renderPagination(page, totalPages, category);

    // See more link
    const seeMore = document.getElementById('see-more-link');
    if (seeMore) {
      seeMore.href = category ? `/?category=${category}&page=2` : '/?page=2';
    }

  } catch (err) {
    document.getElementById('loading-indicator').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
    showToast('Lỗi', err.message || 'Không thể tải tin tức.', 'error');
  }
}

function renderFeaturedArticle(article) {
  const slot = document.getElementById('featured-article-slot');
  if (!slot || !article) return;

  const hasImg = article.image_url && article.image_url.trim();
  slot.innerHTML = `
    <a href="/article/${article.id}" class="featured-article" style="text-decoration:none;">
      ${hasImg
        ? `<img class="featured-article-img" src="${article.image_url}" alt="${article.title}" onerror="this.style.display='none';">`
        : ''}
      <div class="featured-article-overlay"></div>
      <div class="featured-article-body">
        ${article.category_name
          ? `<span class="featured-article-category">${article.category_name}</span>`
          : ''}
        <h2 class="featured-article-title">${article.title}</h2>
        <div class="featured-article-meta">
          <span>✍️ ${article.author_name || 'Biên tập viên'}</span>
          <span>${formatDate(article.published_at)}</span>
        </div>
      </div>
    </a>
  `;
}

function renderPagination(page, total, category) {
  const container = document.getElementById('pagination');
  if (!container || total <= 1) { if (container) container.innerHTML = ''; return; }

  let html = '';
  // Prev button
  html += `<button class="page-btn" onclick="goToPage(${page-1}, '${category||''}')" ${page<=1 ? 'disabled' : ''}>‹</button>`;
  // Page numbers
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= page-2 && i <= page+2)) {
      html += `<button class="page-btn ${i===page?'active':''}" onclick="goToPage(${i}, '${category||''}')">${i}</button>`;
    } else if (i === page-3 || i === page+3) {
      html += `<span style="padding: 0 4px; color: var(--color-gray-400);">…</span>`;
    }
  }
  // Next button
  html += `<button class="page-btn" onclick="goToPage(${page+1}, '${category||''}')" ${page>=total ? 'disabled' : ''}>›</button>`;

  container.innerHTML = html;
}

function goToPage(page, category) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  const url = category ? `/?category=${category}&page=${page}` : `/?page=${page}`;
  window.history.pushState({}, '', url);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadArticles(page, category || null);
}

// ─── TRANG BÀI BÁO CHI TIẾT ──────────────────
let articleData = null;

async function initArticlePage(id) {
  const user = await fetchCurrentUser();
  if (!user) return;

  await fetchAndRenderCategories();

  try {
    const res  = await fetch(`/api/news/${id}`);
    const data = await res.json();

    if (!res.ok) {
      document.getElementById('loading-indicator').style.display = 'none';
      document.getElementById('error-state').style.display = 'block';
      return;
    }

    articleData = data.article;
    const article = data.article;
    const related = data.related || [];

    document.getElementById('loading-indicator').style.display = 'none';
    document.getElementById('article-content').style.display = 'grid';

    // Cập nhật title tab
    document.title = `${article.title} – Army News VNAR`;

    // Render nội dung
    const catEl = document.getElementById('article-category');
    if (catEl) {
      catEl.textContent = article.category_name || '';
      catEl.href = article.category_slug ? `/?category=${article.category_slug}` : '#';
      catEl.style.display = article.category_name ? 'inline-block' : 'none';
    }

    const titleEl = document.getElementById('article-title');
    if (titleEl) titleEl.textContent = article.title;

    // Author avatar (lấy chữ đầu tên)
    const avatarEl = document.getElementById('author-avatar');
    if (avatarEl) avatarEl.textContent = (article.author_name || 'A')[0].toUpperCase();

    const authorEl = document.getElementById('article-author');
    if (authorEl) authorEl.textContent = article.author_name || 'Biên tập viên';

    const dateEl = document.getElementById('article-date');
    if (dateEl) dateEl.textContent = `Đăng ngày ${formatDate(article.published_at)}`;

    // Hero image
    if (article.image_url) {
      const imgEl = document.getElementById('article-hero-img');
      if (imgEl) {
        imgEl.src   = article.image_url;
        imgEl.alt   = article.title;
        imgEl.style.display = 'block';
      }
    }

    // Article body (hỗ trợ HTML)
    const bodyEl = document.getElementById('article-body');
    if (bodyEl) {
      // Nếu nội dung không có thẻ <p>, tự động wrap
      const hasHtml = /<[a-z][\s\S]*>/i.test(article.content);
      if (hasHtml) {
        bodyEl.innerHTML = article.content;
      } else {
        bodyEl.innerHTML = article.content
          .split('\n\n')
          .filter(p => p.trim())
          .map(p => `<p>${p.trim()}</p>`)
          .join('');
      }
    }

    // Hiện nút Sửa/Xóa nếu là tác giả hoặc admin
    if (user.role === 'admin' || user.id === article.author_id) {
      const actionsEl = document.getElementById('article-actions');
      if (actionsEl) actionsEl.style.display = 'flex';
    }

    // Render bài liên quan
    const relatedEl = document.getElementById('related-articles');
    if (relatedEl && related.length > 0) {
      relatedEl.innerHTML = related.map((a, i) => renderSidebarItem(a, i)).join('');
    }

  } catch (err) {
    document.getElementById('loading-indicator').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
  }
}

function goToEdit() {
  if (!articleData) return;
  window.location.href = `/cms?edit=${articleData.id}`;
}

function confirmDelete() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'none';
}

async function executeDelete() {
  if (!articleData) return;
  const btn = document.getElementById('confirm-delete-btn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/cms/articles/${articleData.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Thành công', 'Đã xóa bài báo.', 'success');
      setTimeout(() => { window.location.href = '/'; }, 1200);
    } else {
      const data = await res.json();
      showToast('Lỗi', data.error || 'Không thể xóa bài.', 'error');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  } finally {
    if (btn) btn.disabled = false;
    closeDeleteModal();
  }
}
