import { api, ApiError } from './api.js';

const form = document.querySelector('#login-form');
const error = document.querySelector('#login-error');

// Já autenticado? Vai direto para a área correspondente.
api('/auth/me')
  .then(({ home }) => window.location.replace(home))
  .catch(() => {});

document.querySelectorAll('[data-demo-email]').forEach((button) => {
  button.addEventListener('click', () => {
    form.email.value = button.dataset.demoEmail;
    form.password.value = 'senha123';
    form.password.focus();
  });
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;

  try {
    const { redirectTo } = await api('/auth/login', {
      method: 'POST',
      body: { email: form.email.value, password: form.password.value },
    });
    window.location.assign(redirectTo);
  } catch (err) {
    error.textContent = err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
