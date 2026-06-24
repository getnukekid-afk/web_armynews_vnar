// =============================================
// cms.js – Logic Dashboard Quản lý Bài báo
// =============================================
// Dành cho trang /cms (Editor & Admin)

let editingArticleId = null;
let publishAfterSave = false;
let deleteTargetId   = null;

// ─── KHỞI TẠO TRANG CMS ─────────────────────
async function initCmsPage() {
  // Kiểm tra auth (fetchCurrentUser từ frontend.js)
  const user = await fetchCurrentUser();
  if (!user) return;

  if (user.role !== 'editor' && user.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  // Hiển thị thông tin user trong sidebar
  const infoEl = document.getElementById('cms-user-info');
  if (infoEl) {
    infoEl.textContent = `${user.name} · ${user.role === 'admin' ? 'Admin' : 'Editor'}`;
  }

  // Load categories vào form
  await loadCategoriesForForm();

  // Load danh sách bài
  await loadCmsArticles();

  // Kiểm tra nếu có ?edit=id trong URL → mở form sửa ngay
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId) {
    loadArticleForEdit(editId);
  }

  // Form submit
  document.getElementById('article-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitArticleForm();
  });
}

// ─── LOAD DANH MỤC VÀO FORM ──────────────────
async function loadCategoriesForForm() {
  try {
    const res  = await fetch('/api/news/categories');
    const data = await res.json();
    const select = document.getElementById('art-category');
    if (!select) return;

    (data.categories || []).forEach(cat => {
      const opt   = document.createElement('option');
      opt.value   = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('[CMS] Lỗi load categories:', err);
  }
}

// ─── LOAD DANH SÁCH BÀI ─────────────────────
async function loadCmsArticles() {
  const loading   = document.getElementById('cms-articles-loading');
  const tableWrap = document.getElementById('cms-table-container');
  const emptyEl   = document.getElementById('cms-empty');

  if (loading)   loading.style.display   = 'block';
  if (tableWrap) tableWrap.style.display = 'none';
  if (emptyEl)   emptyEl.style.display   = 'none';

  try {
    const res  = await fetch('/api/cms/articles');
    const data = await res.json();
    const articles = data.articles || [];

    if (loading) loading.style.display = 'none';

    if (articles.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (tableWrap) tableWrap.style.display = 'block';
    renderCmsTable(articles);

  } catch (err) {
    if (loading) loading.style.display = 'none';
    showToast('Lỗi', 'Không thể tải danh sách bài.', 'error');
  }
}

// ─── RENDER BẢNG BÀI ─────────────────────────
function renderCmsTable(articles) {
  const tbody = document.getElementById('cms-table-body');
  if (!tbody) return;

  tbody.innerHTML = articles.map(a => {
    const statusBadge = a.status === 'published'
      ? `<span class="badge badge-success">✅ Đã đăng</span>`
      : `<span class="badge badge-gray">📝 Draft</span>`;

    const updatedDate = a.updated_at
      ? new Date(a.updated_at).toLocaleDateString('vi-VN')
      : '—';

    return `
      <tr>
        <td>
          <div style="font-weight:600; font-size: var(--text-sm); max-width:320px; line-height:1.4;">
            ${a.title}
          </div>
        </td>
        <td>${a.category_name || '<span style="color:var(--color-gray-400)">—</span>'}</td>
        <td style="font-size: var(--text-sm); color: var(--color-gray-600);">${a.author_name || '—'}</td>
        <td>${statusBadge}</td>
        <td style="font-size: var(--text-sm); color: var(--color-gray-400); white-space:nowrap;">${updatedDate}</td>
        <td>
          <div style="display:flex; gap: var(--space-2); flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="loadArticleForEdit(${a.id})">✏️ Sửa</button>
            <button class="btn btn-ghost btn-sm" onclick="togglePublishArticle(${a.id}, '${a.status}')">
              ${a.status === 'published' ? '📥 Hủy đăng' : '🚀 Đăng tải'}
            </button>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteArticle(${a.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── CHUYỂN PANEL ────────────────────────────
function showPanel(panelName) {
  const listPanel = document.getElementById('panel-list');
  const newPanel  = document.getElementById('panel-new');
  const navList   = document.getElementById('nav-list');
  const navNew    = document.getElementById('nav-new');

  if (panelName === 'list') {
    listPanel.style.display = 'block';
    newPanel.style.display  = 'none';
    navList.classList.add('active');
    navNew.classList.remove('active');

    // Reload danh sách khi quay về
    loadCmsArticles();

    // Reset form
    resetArticleForm();
  } else {
    listPanel.style.display = 'none';
    newPanel.style.display  = 'block';
    navList.classList.remove('active');
    navNew.classList.add('active');
  }
}

// ─── RESET FORM ───────────────────────────────
function resetArticleForm() {
  editingArticleId = null;
  publishAfterSave = false;

  document.getElementById('editing-id').value     = '';
  document.getElementById('art-title').value      = '';
  document.getElementById('art-category').value   = '';
  document.getElementById('art-image').value      = '';
  document.getElementById('art-summary').value    = '';
  document.getElementById('art-content').value    = '';

  const titleEl = document.getElementById('article-form-title');
  if (titleEl) titleEl.textContent = '✏️ Viết bài mới';

  const formAlert = document.getElementById('form-alert');
  if (formAlert) formAlert.style.display = 'none';
}

// ─── TẢI BÀI ĐỂ CHỈNH SỬA ──────────────────
async function loadArticleForEdit(id) {
  try {
    const res  = await fetch(`/api/cms/articles/${id}`);
    const data = await res.json();

    if (!res.ok) {
      showToast('Lỗi', data.error || 'Không thể tải bài.', 'error');
      return;
    }

    const article = data.article;
    editingArticleId = article.id;

    // Fill form
    document.getElementById('editing-id').value   = article.id;
    document.getElementById('art-title').value    = article.title;
    document.getElementById('art-category').value = article.category_id || '';
    document.getElementById('art-image').value    = article.image_url || '';
    document.getElementById('art-summary').value  = article.summary || '';
    document.getElementById('art-content').value  = article.content;

    const titleEl = document.getElementById('article-form-title');
    if (titleEl) titleEl.textContent = '✏️ Chỉnh sửa bài';

    showPanel('new');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  }
}

// ─── SUBMIT FORM ──────────────────────────────
function submitAndPublish() {
  publishAfterSave = true;
  document.getElementById('article-form').dispatchEvent(new Event('submit'));
}

async function submitArticleForm() {
  const formAlertEl = document.getElementById('form-alert');
  const formAlertText = document.getElementById('form-alert-text');

  // Hide alert
  if (formAlertEl) formAlertEl.style.display = 'none';

  const title      = document.getElementById('art-title').value.trim();
  const categoryId = document.getElementById('art-category').value || null;
  const imageUrl   = document.getElementById('art-image').value.trim() || null;
  const summary    = document.getElementById('art-summary').value.trim() || null;
  const content    = document.getElementById('art-content').value.trim();

  // Validate
  let valid = true;
  const titleErr   = document.getElementById('art-title-error');
  const contentErr = document.getElementById('art-content-error');
  if (titleErr)   titleErr.textContent   = '';
  if (contentErr) contentErr.textContent = '';

  if (!title) {
    if (titleErr) titleErr.textContent = 'Tiêu đề không được để trống.'; valid = false;
  }
  if (!content) {
    if (contentErr) contentErr.textContent = 'Nội dung không được để trống.'; valid = false;
  }
  if (!valid) { publishAfterSave = false; return; }

  // Disable buttons
  const draftBtn   = document.getElementById('save-draft-btn');
  const publishBtn = document.getElementById('save-publish-btn');
  if (draftBtn)   draftBtn.disabled   = true;
  if (publishBtn) publishBtn.disabled = true;

  try {
    const isEditing = editingArticleId !== null;
    const url    = isEditing ? `/api/cms/articles/${editingArticleId}` : '/api/cms/articles';
    const method = isEditing ? 'PUT' : 'POST';

    const res  = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, category_id: categoryId, summary, content, image_url: imageUrl }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (formAlertEl && formAlertText) {
        formAlertEl.className = 'alert alert-error';
        formAlertEl.style.display = 'flex';
        formAlertText.textContent = data.error || 'Không thể lưu bài.';
      }
    } else {
      const articleId = data.articleId || editingArticleId;

      // Nếu chọn "Lưu & Đăng tải" → gọi thêm publish
      if (publishAfterSave && articleId) {
        const pubRes = await fetch(`/api/cms/articles/${articleId}/publish`, { method: 'PUT' });
        if (pubRes.ok) {
          showToast('Thành công!', 'Bài đã được đăng tải.', 'success');
        }
      } else {
        showToast('Đã lưu!', isEditing ? 'Bài đã được cập nhật.' : 'Bài mới đã được tạo (Draft).', 'success');
      }

      showPanel('list');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  } finally {
    publishAfterSave = false;
    if (draftBtn)   draftBtn.disabled   = false;
    if (publishBtn) publishBtn.disabled = false;
  }
}

// ─── TOGGLE PUBLISH ───────────────────────────
async function togglePublishArticle(id, currentStatus) {
  try {
    const res  = await fetch(`/api/cms/articles/${id}/publish`, { method: 'PUT' });
    const data = await res.json();

    if (res.ok) {
      const label = data.newStatus === 'published' ? 'Đã đăng tải' : 'Chuyển về Draft';
      showToast('Thành công!', label, 'success');
      loadCmsArticles();
    } else {
      showToast('Lỗi', data.error || 'Thao tác thất bại.', 'error');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  }
}

// ─── XÓA BÀI ─────────────────────────────────
function confirmDeleteArticle(id) {
  deleteTargetId = id;
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'flex';

  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      modal.style.display = 'none';
      await executeDeleteArticle(deleteTargetId);
    };
  }
}

async function executeDeleteArticle(id) {
  try {
    const res  = await fetch(`/api/cms/articles/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (res.ok) {
      showToast('Đã xóa', 'Bài báo đã được xóa.', 'success');
      loadCmsArticles();
    } else {
      showToast('Lỗi', data.error || 'Không thể xóa bài.', 'error');
    }
  } catch {
    showToast('Lỗi', 'Lỗi kết nối.', 'error');
  }
}
