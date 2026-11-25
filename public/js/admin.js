import { api, formatDate, logout, renderParagraphs, requireSession } from './api.js';

const user = await requireSession('admin');
document.querySelector('#user-name').textContent = user.name;
document.querySelector('#logout').addEventListener('click', logout);

/* ---------- Configuração da notificação (ativar/desativar) ---------- */

const toggle = document.querySelector('#notice-toggle');
const toggleLabel = document.querySelector('#notice-toggle-label');
const currentVersion = document.querySelector('#current-version');
const currentTitle = document.querySelector('#current-title');
const currentContent = document.querySelector('#current-content');
const versionsList = document.querySelector('#versions');

function renderToggle(enabled) {
  toggle.setAttribute('aria-checked', String(enabled));
  toggleLabel.textContent = enabled
    ? 'Notificação ATIVA — clientes com aceite pendente verão o modal após o login.'
    : 'Notificação DESATIVADA — o modal não será exibido.';
}

async function loadPolicy() {
  const { settings, currentPolicy, versions } = await api('/admin/privacy-policy');
  renderToggle(settings.enabled);

  if (currentPolicy) {
    currentVersion.textContent = `v${currentPolicy.version} · ${formatDate(currentPolicy.publishedAt)}`;
    currentTitle.textContent = currentPolicy.title;
    renderParagraphs(currentContent, currentPolicy.content);
  } else {
    currentVersion.textContent = 'Nenhuma versão publicada';
  }

  versionsList.replaceChildren(
    ...versions.map((policy) => {
      const li = document.createElement('li');
      li.textContent = `v${policy.version} — ${policy.title} (${formatDate(policy.publishedAt)})`;
      return li;
    }),
  );
}

toggle.addEventListener('click', async () => {
  const enabled = toggle.getAttribute('aria-checked') !== 'true';
  toggle.disabled = true;
  try {
    const { settings } = await api('/admin/privacy-policy/settings', { method: 'PATCH', body: { enabled } });
    renderToggle(settings.enabled);
  } catch (err) {
    alert(err.message);
  } finally {
    toggle.disabled = false;
  }
});

/* ---------- Publicação de nova versão ---------- */

const publishForm = document.querySelector('#publish-form');
const publishFeedback = document.querySelector('#publish-feedback');

publishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const confirmed = confirm('Publicar nova versão? Todos os clientes precisarão aceitar novamente.');
  if (!confirmed) return;

  try {
    const { policy } = await api('/admin/privacy-policy/versions', {
      method: 'POST',
      body: { title: publishForm.elements.title.value, content: publishForm.elements.content.value },
    });
    publishForm.reset();
    showFeedback(`Versão ${policy.version} publicada com sucesso.`, 'success');
    await Promise.all([loadPolicy(), loadCustomers()]);
  } catch (err) {
    const details = err.details?.map((d) => d.message).join(' ') ?? '';
    showFeedback(`${err.message} ${details}`.trim(), 'error');
  }
});

function showFeedback(message, type) {
  publishFeedback.textContent = message;
  publishFeedback.className = `alert alert--${type}`;
  publishFeedback.hidden = false;
}

/* ---------- Grid de clientes ---------- */

const filters = document.querySelector('#customer-filters');
const tbody = document.querySelector('#customers tbody');
const totals = document.querySelector('#customer-totals');
let searchDebounce;

async function loadCustomers() {
  const params = new URLSearchParams();
  if (filters.status.value) params.set('status', filters.status.value);
  if (filters.search.value.trim()) params.set('search', filters.search.value.trim());

  const report = await api(`/admin/customers?${params}`);
  totals.textContent =
    `Versão vigente: ${report.currentVersion ? `v${report.currentVersion}` : '—'} · ` +
    `${report.totals.accepted} aceite(s) · ${report.totals.pending} pendente(s) · ${report.totals.all} cliente(s)`;

  if (report.items.length === 0) {
    const row = tbody.insertRow();
    tbody.replaceChildren(row);
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.className = 'empty';
    cell.textContent = 'Nenhum cliente encontrado.';
    return;
  }

  tbody.replaceChildren(...report.items.map(customerRow));
}

function customerRow(item) {
  const row = document.createElement('tr');
  const accepted = item.status === 'accepted';
  const badge = document.createElement('span');
  badge.className = `badge ${accepted ? 'badge--success' : 'badge--warning'}`;
  badge.textContent = accepted ? 'Aceitou' : 'Pendente';

  const cells = [
    item.name,
    item.email,
    badge,
    item.lastAcceptedVersion ? `v${item.lastAcceptedVersion}` : '—',
    formatDate(item.lastAcceptedAt),
  ];
  for (const value of cells) {
    const cell = row.insertCell();
    cell.append(value);
  }
  return row;
}

filters.addEventListener('change', loadCustomers);
filters.search.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadCustomers, 300);
});
filters.addEventListener('submit', (event) => event.preventDefault());

await Promise.all([loadPolicy(), loadCustomers()]);
