const currentUser = requireSession();

if (currentUser) {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const money = (n) => '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let products = [];
  let cart = []; // {id, name, unit, price, qty}

  function showToast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- Header / session ----------
  $('#userNameLabel').textContent = currentUser.name || currentUser.username;
  $('#userRoleLabel').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Vendedor';
  $('#logoutBtn').addEventListener('click', () => {
    clearSession();
    window.location.href = 'login.html';
  });

  const isAdmin = currentUser.role === 'admin';
  if (!isAdmin) {
    $('#catTabBtn').style.display = 'none';
    $('#usersTabBtn').style.display = 'none';
  }

  // ---------- Tabs ----------
  const TAB_IDS = ['pos', 'hist', 'cat', 'pdfs', 'users'];
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      TAB_IDS.forEach((t) => {
        $('#tab-' + t).style.display = t === btn.dataset.tab ? 'block' : 'none';
      });
      if (btn.dataset.tab === 'users') loadUsers();
    });
  });

  // ---------- Init ----------
  async function loadData() {
    try {
      products = await api('/products');
    } catch (e) {
      showToast('No se pudo cargar el catálogo');
      products = [];
    }
    renderProducts();
    renderCatalogAdmin();
    await Promise.all([refreshFolio(), renderHistory(), renderGallery()]);
  }

  async function refreshFolio() {
    try {
      const { folio } = await api('/sales/next-folio');
      $('#nextFolioLabel').textContent = folio;
    } catch (e) {
      /* silencioso */
    }
  }

  // ---------- Products / Catalog ----------
  function renderProducts(filter = '') {
    const grid = $('#productGrid');
    grid.innerHTML = '';
    const list = products.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
    if (list.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);font-size:13px;">Sin resultados.</p>';
      return;
    }
    list.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <span class="icon">${p.icon || '🐟'}</span>
        <h4>${p.name}</h4>
        <span class="price">${money(p.price)} <span class="unit">/ ${p.unit}</span></span>
        <button data-id="${p.id}">Agregar</button>
      `;
      card.querySelector('button').addEventListener('click', () => addToCart(p.id));
      grid.appendChild(card);
    });
  }

  function renderCatalogAdmin() {
    const grid = $('#catAdminGrid');
    grid.innerHTML = '';
    products.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <button class="edit-x" data-id="${p.id}">Eliminar ✕</button>
        <span class="icon">${p.icon || '🐟'}</span>
        <h4>${p.name}</h4>
        <span class="price">${money(p.price)} <span class="unit">/ ${p.unit}</span></span>
      `;
      card.querySelector('.edit-x').addEventListener('click', async () => {
        try {
          await api(`/products/${p.id}`, { method: 'DELETE' });
          products = products.filter((x) => x.id !== p.id);
          renderProducts($('#searchProd').value);
          renderCatalogAdmin();
          showToast('Producto eliminado');
        } catch (e) {
          showToast(e.message);
        }
      });
      grid.appendChild(card);
    });
  }

  $('#addProdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    const price = parseFloat(fd.get('price'));
    const unit = fd.get('unit');
    const icon = fd.get('icon').trim() || '🐟';
    if (!name || isNaN(price)) return;
    try {
      const product = await api('/products', {
        method: 'POST',
        body: JSON.stringify({ name, price, unit, icon }),
      });
      products.push(product);
      renderProducts($('#searchProd').value);
      renderCatalogAdmin();
      e.target.reset();
      showToast('Producto agregado al catálogo');
    } catch (err) {
      showToast(err.message);
    }
  });

  $('#searchProd').addEventListener('input', (e) => renderProducts(e.target.value));

  // ---------- Cart ----------
  function addToCart(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const existing = cart.find((c) => c.id === productId);
    if (existing) existing.qty += 1;
    else cart.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty: 1 });
    renderCart();
  }

  function renderCart() {
    const box = $('#cartItems');
    box.innerHTML = '';
    $('#emptyCart').style.display = cart.length === 0 ? 'block' : 'none';
    cart.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <span class="nm">${c.name}<br><span style="font-weight:400;color:var(--muted);font-size:11px;">${money(c.price)} / ${c.unit}</span></span>
        <input type="number" min="0.1" step="0.1" value="${c.qty}" data-idx="${idx}">
        <span class="sub">${money(c.price * c.qty)}</span>
        <button class="rm" data-idx="${idx}">✕</button>
      `;
      row.querySelector('input').addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        cart[idx].qty = isNaN(v) || v <= 0 ? 0.1 : v;
        renderCart();
      });
      row.querySelector('.rm').addEventListener('click', () => {
        cart.splice(idx, 1);
        renderCart();
      });
      box.appendChild(row);
    });
    updateTotals();
  }

  function calcTotals() {
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    return { total };
  }
  function updateTotals() {
    const { total } = calcTotals();
    $('#totalVal').textContent = money(total);
  }

  $('#clearCartBtn').addEventListener('click', () => {
    cart = [];
    renderCart();
  });

  // ---------- Register sale + Receipt ----------
  $('#registerSaleBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
      showToast('Agrega al menos un producto');
      return;
    }
    const btn = $('#registerSaleBtn');
    btn.disabled = true;
    try {
      const sale = await api('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer: $('#custName').value.trim() || 'Cliente mostrador',
          payment: $('#payMethod').value,
          notes: $('#notesField').value.trim(),
          items: cart.map((c) => ({ id: c.id, name: c.name, unit: c.unit, price: c.price, qty: c.qty })),
        }),
      });

      await refreshFolio();
      await renderHistory();
      showReceipt(sale);

      cart = [];
      renderCart();
      $('#custName').value = '';
      $('#notesField').value = '';
      showToast('Venta registrada correctamente');
    } catch (err) {
      showToast(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  function showReceipt(sale) {
    const d = new Date(sale.date);
    const fecha = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const itemsRows = sale.items
      .map(
        (it) => `
      <tr>
        <td>${it.name}<br><span style="color:var(--muted);font-size:10.5px;">${it.qty} ${it.unit} × ${money(it.price)}</span></td>
        <td class="num">${money(it.subtotal != null ? it.subtotal : it.price * it.qty)}</td>
      </tr>`
      )
      .join('');

    $('#receiptContent').innerHTML = `
      <button class="close-x" id="closeReceiptBtn2">✕</button>
      <div id="receiptPrintArea">
        <div class="rhead">
          <div class="icon" style="font-size:28px;">🦐</div>
          <h3>Castillos Frozen Foods</h3>
          <p>Progreso, Yucatán · Pescados y mariscos</p>
          <p class="slogan">Frescura y calidad que enamoran</p>
        </div>
        <div class="meta">
          <span>Folio <b>${sale.folio}</b></span>
          <span>${fecha}, ${hora}</span>
        </div>
        <div style="font-size:12px;margin-bottom:8px;">
          <b>Cliente:</b> ${sale.customer}<br>
          <b>Pago:</b> ${sale.payment.charAt(0).toUpperCase() + sale.payment.slice(1)}
          ${sale.notes ? `<br><b>Notas:</b> ${sale.notes}` : ''}
        </div>
        <table>
          <thead><tr><th>Producto</th><th class="num">Importe</th></tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>
        <div class="rtotals">
          <div class="row total"><span>Total</span><span>${money(sale.total)}</span></div>
        </div>
        <div class="foot">Gracias por su compra 🐟<br><b>Castillos Frozen Foods</b></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="downloadReceiptBtn">${sale.hasPdf ? 'Descargar PDF' : 'Generar y descargar PDF'}</button>
        <button class="btn btn-primary" id="closeReceiptBtn3">Cerrar</button>
      </div>
    `;
    $('#receiptModal').classList.add('show');
    $('#downloadReceiptBtn').addEventListener('click', () => downloadReceiptPDF(sale));
    $('#closeReceiptBtn2').addEventListener('click', closeReceipt);
    $('#closeReceiptBtn3').addEventListener('click', closeReceipt);
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadReceiptPDF(sale) {
    const btn = $('#downloadReceiptBtn');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.textContent = 'Generando...';
      btn.disabled = true;
    }
    try {
      if (sale.hasPdf) {
        // Ya existe en el servidor: solo se descarga.
        const blob = await api(`/receipts/${sale.id}/pdf`);
        triggerBlobDownload(blob, `${sale.folio}.pdf`);
        showToast('PDF descargado');
        return;
      }

      // Primera vez: se renderiza el comprobante visual a PDF en el navegador...
      const el = $('#receiptPrintArea');
      const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const blob = pdf.output('blob');

      // ...y se descarga localmente...
      triggerBlobDownload(blob, `${sale.folio}.pdf`);

      // ...y además se sube al servidor para que quede guardado en "PDFs descargados".
      const fd = new FormData();
      fd.append('file', blob, `${sale.folio}.pdf`);
      await api(`/receipts/${sale.id}/pdf`, { method: 'POST', body: fd });
      sale.hasPdf = true;

      await renderGallery($('#searchPdf') ? $('#searchPdf').value : '');
      await renderHistory($('#searchHist') ? $('#searchHist').value : '');
      showToast('PDF descargado y guardado');
    } catch (e) {
      showToast(e.message || 'No se pudo generar el PDF');
    } finally {
      if (btn) {
        btn.textContent = originalLabel;
        btn.disabled = false;
      }
    }
  }

  function closeReceipt() {
    $('#receiptModal').classList.remove('show');
  }
  $('#closeReceiptBtn').addEventListener('click', closeReceipt);
  $('#receiptModal').addEventListener('click', (e) => {
    if (e.target.id === 'receiptModal') closeReceipt();
  });

  // ---------- PDF gallery ----------
  async function renderGallery(filter = '') {
    const grid = $('#pdfGallery');
    let list = [];
    try {
      list = await api(`/receipts?search=${encodeURIComponent(filter)}`);
    } catch (e) {
      /* silencioso */
    }
    grid.innerHTML = '';
    $('#pdfGalleryEmpty').style.display = list.length === 0 ? 'block' : 'none';
    list.forEach((s) => {
      const d = new Date(s.date);
      const card = document.createElement('div');
      card.className = 'pdf-card';
      card.innerHTML = `
        <div class="pdf-thumb">📄</div>
        <div class="pdf-meta">
          <b>${s.folio}</b>
          <span>${s.customer}</span>
          <span>${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span class="pdf-total">${money(s.total)}</span>
        </div>
        <div class="pdf-actions">
          <button class="btn btn-ghost btn-sm dl-btn">Descargar</button>
        </div>
      `;
      card.querySelector('.dl-btn').addEventListener('click', async () => {
        try {
          const blob = await api(`/receipts/${s.id}/pdf`);
          triggerBlobDownload(blob, `${s.folio}.pdf`);
        } catch (e) {
          showToast(e.message);
        }
      });
      grid.appendChild(card);
    });
  }
  $('#searchPdf').addEventListener('input', (e) => renderGallery(e.target.value));

  // ---------- History ----------
  async function renderHistory(filter = '') {
    const body = $('#histBody');
    let list = [];
    try {
      list = await api(`/sales?search=${encodeURIComponent(filter)}`);
    } catch (e) {
      /* silencioso */
    }
    body.innerHTML = '';
    $('#histEmpty').style.display = list.length === 0 ? 'block' : 'none';
    list.forEach((s) => {
      const d = new Date(s.date);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.folio}</td>
        <td>${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${s.customer}</td>
        <td><span class="pill ${s.payment}">${s.payment}</span></td>
        <td>${money(s.total)}</td>
        <td>
          <button class="link-btn">Ver comprobante</button>
          ${s.hasPdf ? '<span class="pill efectivo" style="margin-left:6px;">PDF ✓</span>' : ''}
        </td>
      `;
      tr.querySelector('.link-btn').addEventListener('click', () => showReceipt(s));
      body.appendChild(tr);
    });
  }
  $('#searchHist').addEventListener('input', (e) => renderHistory(e.target.value));

  // ---------- Users (admin) ----------
  async function loadUsers() {
    if (!isAdmin) return;
    const body = $('#usersBody');
    let users = [];
    try {
      users = await api('/users');
    } catch (e) {
      showToast(e.message);
    }
    body.innerHTML = '';
    users.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.name}</td>
        <td>${u.username}</td>
        <td><span class="pill ${u.role}">${u.role === 'admin' ? 'Administrador' : 'Vendedor'}</span></td>
        <td>${new Date(u.created_at).toLocaleDateString('es-MX')}</td>
        <td>${u.id === currentUser.id ? '' : '<button class="link-btn del-user">Eliminar</button>'}</td>
      `;
      const delBtn = tr.querySelector('.del-user');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm(`¿Eliminar al usuario "${u.username}"?`)) return;
          try {
            await api(`/users/${u.id}`, { method: 'DELETE' });
            loadUsers();
            showToast('Usuario eliminado');
          } catch (e) {
            showToast(e.message);
          }
        });
      }
      body.appendChild(tr);
    });
  }

  if (isAdmin) {
    $('#addUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: fd.get('name').trim(),
            username: fd.get('username').trim(),
            password: fd.get('password'),
            role: fd.get('role'),
          }),
        });
        e.target.reset();
        loadUsers();
        showToast('Usuario creado');
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // ---------- Init ----------
  loadData();
}
