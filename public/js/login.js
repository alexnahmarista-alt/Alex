function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// Si ya hay una sesión activa, salta directo a la app
if (getToken()) {
  window.location.href = 'index.html';
}

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.style.display = 'none';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = form.querySelector('button[type=submit]');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Entrando...';
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setSession(data.token, data.user);
    window.location.href = 'index.html';
  } catch (err) {
    errorEl.textContent = err.message || 'No se pudo iniciar sesión.';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }
});
