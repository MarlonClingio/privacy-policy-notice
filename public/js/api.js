/** Cliente HTTP mínimo para a API. Lança `ApiError` em respostas não-2xx. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data.error ?? {};
    throw new ApiError(response.status, error.code, error.message ?? 'Erro inesperado.', error.details);
  }
  return data;
}

/** Garante sessão válida (e papel, se informado); caso contrário volta ao login. */
export async function requireSession(role) {
  try {
    const { user, home } = await api('/auth/me');
    if (role && user.role !== role) {
      window.location.replace(home);
      return new Promise(() => {});
    }
    return user;
  } catch {
    window.location.replace('/');
    return new Promise(() => {});
  }
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  window.location.replace('/');
}

export function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/** Renderiza texto puro em parágrafos, sem interpretar HTML (evita XSS). */
export function renderParagraphs(container, text) {
  container.replaceChildren(
    ...text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const p = document.createElement('p');
        p.textContent = chunk;
        return p;
      }),
  );
}
