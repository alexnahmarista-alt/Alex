// Cliente ligero para hablar con la API del backend, con manejo de sesión (JWT).
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('cff_token');
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem('cff_user') || 'null');
  } catch (e) {
    return null;
  }
}
function setSession(token, user) {
  localStorage.setItem('cff_token', token);
  localStorage.setItem('cff_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('cff_token');
  localStorage.removeItem('cff_user');
}

function goToLogin() {
  clearSession();
  window.location.href = 'login.html';
}

/**
 * Llama a la API. Devuelve JSON o Blob según el content-type de la respuesta.
 * Lanza un Error con el mensaje del backend si la respuesta no es OK.
 */
async function api(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers);
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + path, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    goToLogin();
    throw new Error('Sesión expirada. Inicia sesión de nuevo.');
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();

  if (!res.ok) {
    const message = isJson && data && data.error ? data.error : 'Ocurrió un error de red.';
    throw new Error(message);
  }
  return data;
}

// Protege una página: si no hay sesión, manda a login.html
function requireSession() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return null;
  }
  return getUser();
}
