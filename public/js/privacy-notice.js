import { api, ApiError, formatDate, renderParagraphs } from './api.js';

export async function initPrivacyNotice({ onAccepted } = {}) {
  const notice = await api('/privacy-notice');
  if (!notice.required) return { shown: false };

  const acceptance = await showModal(notice.policy);
  onAccepted?.(acceptance);
  return { shown: true, acceptance };
}

function showModal(policy) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const { overlay, dialog, body, meta, title, error, button } = buildModal();

    const render = (current) => {
      policy = current;
      title.textContent = current.title;
      meta.textContent = `Versão ${current.version} · publicada em ${formatDate(current.publishedAt)}`;
      renderParagraphs(body, current.content);
      body.scrollTop = 0;
    };

    const close = (acceptance) => {
      overlay.remove();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', trapKeys, true);
      previousFocus?.focus?.();
      resolve(acceptance);
    };

    const trapKeys = (event) => {
      if (event.key === 'Escape') event.preventDefault();
      if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === button ? body : button).focus();
      }
    };

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Registrando...';
      error.hidden = true;

      try {
        const { acceptance } = await api('/privacy-notice/accept', {
          method: 'POST',
          body: { version: policy.version },
        });
        close(acceptance);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const latest = await api('/privacy-notice');
          if (!latest.required) return close(null);
          render(latest.policy);
        }
        error.textContent = err.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
        button.textContent = 'Li e aceito';
      }
    });

    render(policy);
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', trapKeys, true);
    dialog.focus();
  });
}

function buildModal() {
  const overlay = el('div', { className: 'modal-overlay' });
  const dialog = el('div', {
    className: 'modal',
    role: 'dialog',
    tabIndex: -1,
    'aria-modal': 'true',
    'aria-labelledby': 'privacy-notice-title',
    'aria-describedby': 'privacy-notice-body',
  });
  const header = el('header', { className: 'modal__header' });
  const badge = el('span', { className: 'badge badge--warning', textContent: 'Atualização importante' });
  const title = el('h2', { id: 'privacy-notice-title' });
  const meta = el('p', { className: 'modal__meta' });
  const body = el('div', { id: 'privacy-notice-body', className: 'modal__body', tabIndex: 0 });
  const error = el('p', { className: 'alert alert--error', role: 'alert', hidden: true });
  const footer = el('footer', { className: 'modal__footer' });
  const button = el('button', { type: 'button', className: 'btn btn--primary', textContent: 'Li e aceito' });

  header.append(badge, title, meta);
  footer.append(button);
  dialog.append(header, body, error, footer);
  overlay.append(dialog);

  return { overlay, dialog, body, meta, title, error, button };
}

function el(tag, props) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('aria-') || key === 'role') node.setAttribute(key, value);
    else node[key] = value;
  }
  return node;
}
