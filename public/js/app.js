import { formatDate, logout, requireSession } from './api.js';
import { initPrivacyNotice } from './privacy-notice.js';

const user = await requireSession('customer');
document.querySelector('#user-name').textContent = user.name;
document.querySelector('#logout').addEventListener('click', logout);

const status = document.querySelector('#privacy-status');

const { shown, acceptance } = await initPrivacyNotice();
if (shown && acceptance) {
  status.textContent = `Obrigado! Seu aceite da política v${acceptance.policyVersion} foi registrado em ${formatDate(acceptance.acceptedAt)}.`;
  status.className = 'alert alert--success';
} else {
  status.textContent = 'Você está em dia com a versão vigente da Política de Privacidade.';
  status.className = 'alert alert--info';
}
status.hidden = false;
