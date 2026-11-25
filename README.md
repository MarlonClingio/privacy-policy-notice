# Notificação de Política de Privacidade — Mercado Eletrônico

Solução para o **Teste Técnico p/ Desenvolvedor do Time Mercado Eletrônico (SouEnergy)**.

Após o login, se o cliente ainda não aceitou a **versão vigente** da Política de Privacidade, é exibido um
modal com o texto da política e um botão de confirmação. O aceite é persistido (vinculado à versão), então
o modal não aparece novamente — até que uma nova versão seja publicada. No painel administrativo é possível
ativar/desativar a notificação, publicar novas versões do texto e ver, na grid de clientes, quem já aceitou.

| Stack | |
| --- | --- |
| Runtime | Node.js **22.13+** (testado em 22.22) |
| Linguagem | TypeScript (backend) · JavaScript ES Modules sem build (frontend) |
| HTTP | Express 5 |
| Banco | SQLite via módulo nativo `node:sqlite` (sem dependências nativas para compilar) |
| Validação | Zod |
| Testes | Vitest + Supertest |

---

## Sumário

1. [Requisitos atendidos](#1-requisitos-atendidos)
2. [Concepção e implementação](#2-concepção-e-implementação)
3. [Instalação e configuração](#3-instalação-e-configuração)
4. [Testes](#4-testes)
5. [Estrutura de código e arquitetura](#5-estrutura-de-código-e-arquitetura)
6. [API](#6-api)
7. [Como estender](#7-como-estender)
8. [Decisões, limitações e próximos passos](#8-decisões-limitações-e-próximos-passos)

---

## 1. Requisitos atendidos

| Requisito do teste | Onde está |
| --- | --- |
| Modal exibido após o login se o usuário não aceitou a versão vigente | [`public/js/privacy-notice.js`](public/js/privacy-notice.js) + `GET /api/privacy-notice` |
| **1a.** Botão para ativar/desativar a exibição da notificação | Switch no painel admin ([`public/admin.html`](public/admin.html)) → `PATCH /api/admin/privacy-policy/settings` |
| **1b.** Texto da notificação com os termos | Versões da política (título + texto) editáveis pelo admin → `POST /api/admin/privacy-policy/versions` |
| **2.** Verificar aceite prévio para evitar notificações repetidas | [`PrivacyNoticeService`](src/services/privacy-notice-service.ts) + tabela `privacy_policy_acceptances` com `UNIQUE (user_id, policy_version)` |
| **3.** Grid de usuários no admin mostrando se aceitou ou não | Tabela "Clientes" em [`public/admin.html`](public/admin.html) → `GET /api/admin/customers` (com filtro por status e busca) |
| Aceite persistido | SQLite (arquivo `data/app.db`), sobrevive a novos logins e reinícios |

---

## 2. Concepção e implementação

### 2.1 Ideia central: o aceite pertence a uma **versão** da política

O ponto principal do desenho é não guardar um simples booleano `aceitou = true` no usuário. Em vez disso:

- Cada alteração da política gera uma **nova versão imutável** (`privacy_policy_versions`, com `version` 1, 2, 3...).
  A versão vigente é a de maior número.
- Cada aceite é um registro em `privacy_policy_acceptances` ligando **usuário + versão**, com data, IP e user-agent
  (útil como evidência de consentimento para a LGPD).

Com isso, a regra "o usuário precisa ver o modal?" fica simples e sempre correta:

```
mostrar modal  ⇔  notificação ativa
               ∧  usuário é cliente
               ∧  existe política publicada
               ∧  NÃO existe aceite (usuário, versão vigente)
```

Quando o admin publica uma nova versão, **todos os clientes voltam a ficar pendentes automaticamente**, sem
nenhum "reset" em massa, e o histórico de aceites anteriores é preservado.

### 2.2 Fluxo

```
 Cliente                       Frontend (app.html)                 Backend
 ───────                       ───────────────────                 ───────
 login  ───────────────────►  POST /api/auth/login  ───────────►  valida senha (scrypt), cria sessão (cookie httpOnly)
                               redireciona p/ /app.html
                               initPrivacyNotice()
                               GET /api/privacy-notice ─────────►  PrivacyNoticeService.getNoticeFor(user)
                                                       ◄─────────  { required: true, policy: {...} }
 vê o modal (bloqueante)
 clica "Li e aceito" ───────►  POST /api/privacy-notice/accept ──►  valida que version == vigente (senão 409)
                               { version: 1 }                       grava aceite (idempotente) + emite evento
                                                       ◄─────────  201 { acceptance }
 próximo login ─────────────►  GET /api/privacy-notice ─────────►  { required: false }  → modal não aparece
```

### 2.3 Detalhes de comportamento

- **Modal obrigatório e acessível**: `role="dialog"`, `aria-modal`, foco preso dentro do modal, `Esc` não fecha,
  rolagem da página bloqueada. Só fecha com o aceite.
- **Corrida entre publicação e aceite**: o cliente envia a versão que leu. Se o admin publicou outra versão enquanto
  o modal estava aberto, a API responde `409` e o modal recarrega o texto novo — ninguém "aceita sem ler".
- **Idempotência**: aceitar duas vezes a mesma versão mantém o registro original (constraint `UNIQUE` +
  `ON CONFLICT DO NOTHING`) e o evento de domínio é emitido uma única vez.
- **Toggle desativado**: o modal não aparece para ninguém, mas a grid continua mostrando quem está pendente.
  Ao reativar, os pendentes voltam a ver o modal.
- **Administradores** não recebem o modal (a política é dirigida a clientes).
- **Segurança**: senhas com `scrypt` + salt, comparação em tempo constante, cookie `httpOnly` + `SameSite=Lax`
  (`Secure` em produção), autorização por papel nas rotas admin, validação de entrada com Zod, texto da política
  renderizado com `textContent` (sem `innerHTML`, evitando XSS), limite de 100 kB no corpo JSON.

---

## 3. Instalação e configuração

### Pré-requisitos

- **Node.js 22.13 ou superior** (necessário para o módulo nativo `node:sqlite`). Verifique com `node -v`.
- npm (vem com o Node).

Não é necessário instalar banco de dados, Docker ou compiladores.

### Passo a passo

```bash
git clone <url-do-repositorio>
cd Electronic-marketplace

npm install

# (opcional) personalizar configurações
cp .env.example .env

# desenvolvimento (TypeScript direto, com reload automático)
npm run dev

# ou produção
npm run build
npm start
```

Acesse **http://localhost:3000**.

> **Windows/PowerShell:** se aparecer o erro "a execução de scripts foi desabilitada", use `npm.cmd` no lugar de
> `npm` (ex.: `npm.cmd install`) ou rode os comandos pelo Prompt de Comando.

### Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `DATABASE_PATH` | `./data/app.db` | Arquivo SQLite (criado automaticamente). Use `:memory:` para banco volátil |
| `SESSION_TTL_MINUTES` | `120` | Duração da sessão |
| `SEED_DEMO_DATA` | `true` | Cria usuários de demonstração e a política v1 quando o banco está vazio |
| `NODE_ENV` | — | Com `production`, o cookie de sessão passa a ser `Secure` |

O schema é criado/atualizado automaticamente na inicialização (migrações em
[`src/repositories/sqlite/database.ts`](src/repositories/sqlite/database.ts)). Para recomeçar do zero, apague a
pasta `data/`.

### Usuários de demonstração

Todos com a senha **`senha123`** (também há botões de atalho na tela de login):

| Usuário | Papel | Situação inicial |
| --- | --- | --- |
| `admin@exemplo.com` | admin | — |
| `ana@exemplo.com` | cliente | pendente (verá o modal) |
| `bruno@exemplo.com` | cliente | pendente (verá o modal) |
| `carla@exemplo.com` | cliente | já aceitou a v1 (não verá o modal) |

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor com `tsx watch` |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Executa a versão compilada |
| `npm test` | Roda todos os testes |
| `npm run typecheck` | Verificação de tipos (inclui os testes) |

---

## 4. Testes

```bash
npm test
```

São **22 testes** em dois níveis, cada um com banco SQLite **em memória** isolado:

- [`tests/privacy-notice-service.test.ts`](tests/privacy-notice-service.test.ts) — regras de negócio nos serviços.
- [`tests/api.test.ts`](tests/api.test.ts) — fluxo HTTP completo com Supertest (login, cookies, permissões, validação).

Cenários cobertos:

| Cenário | Resultado esperado |
| --- | --- |
| Cliente sem aceite da versão vigente | `required: true` com a política |
| Cliente aceita e faz novo login | `required: false` (aceite persistido) |
| Admin publica nova versão | quem tinha aceitado a anterior volta a `required: true` |
| Notificação desativada / reativada pelo admin | `required: false` / volta a `true` |
| Usuário admin | nunca recebe o modal |
| Nenhuma política publicada | sem modal; aceite retorna `404` |
| Aceite de versão desatualizada | `409 CONFLICT` |
| Aceite repetido | mesmo registro, evento emitido uma vez |
| Grid admin | status por cliente, totais, filtro `pending/accepted`, busca por nome/e-mail, última versão aceita |
| Cliente acessando rota admin | `403` |
| Sem sessão / após logout | `401` |
| Credenciais inválidas | `401` |
| Corpo inválido (aceite e publicação) | `400 VALIDATION_ERROR` com detalhes |

### Roteiro de teste manual (navegador)

1. `npm run dev` e abrir http://localhost:3000.
2. Entrar como **Ana** → o modal aparece. Clicar em **Li e aceito** → mensagem de confirmação.
3. Recarregar a página / sair e entrar de novo → o modal **não** aparece mais.
4. Entrar como **Carla** → não há modal (já aceitou no seed).
5. Entrar como **Administrador**:
   - Grid "Clientes": Ana e Carla como **Aceitou**, Bruno como **Pendente**. Testar o filtro e a busca.
   - Desligar o switch "Notificação aos clientes" → entrar como **Bruno**: sem modal. Religar → modal aparece.
   - Publicar uma nova versão → na grid todos ficam **Pendente** (com a "última versão aceita" preservada);
     ao entrar como Ana, o modal mostra o novo texto.

### Testando a API com cURL

```bash
# login (salva o cookie de sessão)
curl -i -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"bruno@exemplo.com","password":"senha123"}' http://localhost:3000/api/auth/login

# há notificação pendente?
curl -b cookies.txt http://localhost:3000/api/privacy-notice
# {"required":true,"policy":{"id":1,"version":1,"title":"...","content":"...","publishedAt":"..."}}

# aceitar a versão 1
curl -b cookies.txt -H "Content-Type: application/json" -d '{"version":1}' \
  http://localhost:3000/api/privacy-notice/accept

# consultar de novo
curl -b cookies.txt http://localhost:3000/api/privacy-notice
# {"required":false}
```

---

## 5. Estrutura de código e arquitetura

```
.
├── public/                         # Frontend estático (sem build), servido pelo Express
│   ├── index.html                  # Login
│   ├── app.html                    # Área do cliente (onde o modal aparece)
│   ├── admin.html                  # Painel admin: toggle, versões da política, grid de clientes
│   ├── css/styles.css
│   └── js/
│       ├── api.js                  # Cliente HTTP + utilitários (sessão, datas, render seguro de texto)
│       ├── privacy-notice.js       # ★ Módulo do modal — reutilizável em qualquer página autenticada
│       ├── app.js | admin.js | login.js
├── src/
│   ├── server.ts                   # Bootstrap: .env, container, seed, listeners de auditoria, listen
│   ├── app.ts                      # createApp(): monta middlewares e rotas (usado também nos testes)
│   ├── container.ts                # Composition root (injeção de dependências manual)
│   ├── config.ts | seed.ts
│   ├── domain/                     # Tipos de domínio e erros (sem dependência de framework)
│   │   ├── privacy-policy.ts | user.ts | errors.ts
│   ├── services/                   # Regras de negócio
│   │   ├── privacy-notice-service.ts        # cliente: precisa ver o modal? registrar aceite
│   │   ├── privacy-policy-admin-service.ts  # admin: toggle, publicar versão, relatório da grid
│   │   ├── auth-service.ts | password-hasher.ts | session-store.ts
│   ├── repositories/
│   │   ├── contracts.ts            # Interfaces de persistência
│   │   └── sqlite/                 # Implementações SQLite + migrações
│   ├── events/event-bus.ts         # Eventos de domínio tipados
│   └── http/                       # Camada de entrega (Express)
│       ├── middlewares/            # authenticate, requireRole, errorHandler
│       ├── routes/                 # auth, privacy-notice, admin
│       └── validation.ts           # parse() com Zod → ValidationError
└── tests/                          # Vitest + Supertest
```

### Camadas

```
 HTTP (routes, middlewares, Zod)  →  Services (regras)  →  Repository contracts  ←  SQLite repositories
                                          │
                                          └──►  EventBus  ──►  listeners (auditoria, futuras integrações)
```

- **Domínio** (`src/domain`): tipos puros e erros de aplicação. Nenhuma dependência de Express ou banco.
- **Serviços** (`src/services`): toda a regra de negócio. Dependem **apenas de interfaces** de repositório, o que
  os torna testáveis e independentes do banco.
- **Repositórios** (`src/repositories`): `contracts.ts` define o que a aplicação precisa; `sqlite/` implementa.
  As consultas da grid são feitas em SQL com `LEFT JOIN` (uma query, sem N+1).
- **HTTP** (`src/http`): fina — valida entrada, chama o serviço e serializa a saída. Erros de domínio
  (`ValidationError`, `ConflictError`...) carregam o status HTTP e são convertidos num formato único pelo
  `errorHandler`: `{ "error": { "code", "message", "details?" } }`.
- **Composition root** (`src/container.ts`): único lugar que instancia classes concretas. Trocar uma
  implementação é mudar uma linha.
- **Frontend**: JavaScript puro em ES Modules, sem etapa de build. O modal é um módulo independente
  (`initPrivacyNotice()`), que pode ser importado em qualquer página.

### Modelo de dados

```
users                         privacy_policy_versions           privacy_policy_acceptances
─────                         ───────────────────────           ──────────────────────────
id PK                         id PK                             id PK
name                          version UNIQUE  ◄──────────────── policy_version FK
email UNIQUE                  title                             user_id FK ──► users.id
password_hash                 content                           accepted_at
role (customer|admin)         published_at                      ip_address, user_agent
created_at                                                      UNIQUE (user_id, policy_version)

settings (key PK, value)  →  'privacy_notice.enabled' = '1' | '0'
schema_migrations         →  controle das migrações aplicadas
```

---

## 6. API

Todas as respostas são JSON. Rotas (exceto login) exigem o cookie de sessão `sid`.

| Método | Rota | Papel | Descrição |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | — | `{ email, password }` → `{ user, redirectTo }` + cookie |
| `POST` | `/api/auth/logout` | qualquer | Encerra a sessão (`204`) |
| `GET` | `/api/auth/me` | qualquer | Usuário logado |
| `GET` | `/api/privacy-notice` | qualquer | `{ required: false }` ou `{ required: true, policy }` |
| `POST` | `/api/privacy-notice/accept` | qualquer | `{ version }` → `201 { acceptance }` · `409` se não for a vigente |
| `GET` | `/api/admin/privacy-policy` | admin | `{ settings, currentPolicy, versions }` |
| `PATCH` | `/api/admin/privacy-policy/settings` | admin | `{ enabled: boolean }` — liga/desliga a notificação |
| `POST` | `/api/admin/privacy-policy/versions` | admin | `{ title, content }` → publica nova versão |
| `GET` | `/api/admin/customers?status=&search=` | admin | `{ currentVersion, totals, items[] }` para a grid |

Exemplo de `GET /api/admin/customers`:

```json
{
  "currentVersion": 2,
  "totals": { "all": 3, "accepted": 1, "pending": 2 },
  "items": [
    { "userId": 2, "name": "Ana Souza", "email": "ana@exemplo.com", "status": "accepted",
      "lastAcceptedVersion": 2, "lastAcceptedAt": "2026-11-25T13:51:00.000Z", "createdAt": "..." },
    { "userId": 3, "name": "Bruno Lima", "email": "bruno@exemplo.com", "status": "pending",
      "lastAcceptedVersion": 1, "lastAcceptedAt": "2026-11-20T10:00:00.000Z", "createdAt": "..." }
  ]
}
```

---

## 7. Como estender

A estrutura foi pensada para que novas funcionalidades entrem **sem modificar** o que já funciona:

| Quero... | Como |
| --- | --- |
| Enviar e-mail / webhook / log de auditoria quando alguém aceitar ou quando sair nova versão | Registrar um listener: `container.events.on('privacy-policy.accepted', ...)` (ver `src/server.ts`). Eventos disponíveis em [`src/events/event-bus.ts`](src/events/event-bus.ts) |
| Usar MySQL/PostgreSQL | Implementar as interfaces de [`contracts.ts`](src/repositories/contracts.ts) e trocar as instâncias em `container.ts` |
| Sessões em Redis | Implementar `SessionStore` e trocar em `container.ts` |
| Outros termos (Termos de Uso, cookies...) | O modelo versão + aceite é genérico: adicionar uma coluna `document_type` nas duas tabelas (nova migração) e parametrizar os serviços pelo tipo |
| Novas regras de exibição (ex.: só para clientes de certo segmento) | Ajustar `PrivacyNoticeService.getNoticeFor` — é o único ponto de decisão |
| Mudar o schema | Acrescentar um item ao array `MIGRATIONS` em `database.ts` |
| Exibir o modal em outra página | `import { initPrivacyNotice } from '/js/privacy-notice.js'; await initPrivacyNotice();` |
| Exportar a grid (CSV) | Reutilizar `PrivacyPolicyAdminService.listCustomerConsents` numa nova rota |

---

## 8. Decisões, limitações e próximos passos

**Por que Node.js e não Magento?** O enunciado permite qualquer stack. Optei por uma solução que roda com um único
`npm install`, sem Docker ou banco externo, para que o avaliador consiga executar e testar em minutos. A modelagem
(versões + aceites + configuração + eventos) se traduz diretamente para um módulo Magento 2: as tabelas viram
`db_schema.xml`, o toggle e o texto viram `system.xml`/admin form, o modal vira um componente `Magento_Ui/js/modal`
num `customer-data` section, a coluna da grid vira um `ui_component` em `customer_listing.xml` e os eventos de
domínio viram `events.xml`/observers.

**Decisões**
- `node:sqlite` nativo: zero dependências nativas (nada de `node-gyp`), ideal para avaliação local. O Node emite um
  `ExperimentalWarning` ao usá-lo; ele é suprimido no `npm start`.
- Sessão em memória: simples e suficiente para o escopo; reiniciar o servidor exige novo login (os aceites
  continuam salvos no banco).
- Frontend sem framework: o foco do teste é o fluxo e o modal; evita build e mantém o projeto enxuto.

**Próximos passos sugeridos**
- Paginação server-side na grid (hoje o volume é pequeno).
- Proteção CSRF por token (hoje mitigada por `SameSite=Lax` + `Content-Type: application/json`) e rate-limit no login.
- CRUD de usuários e cadastro de clientes.
- Exportação CSV dos aceites e trilha de auditoria persistida.
- Internacionalização dos textos.
- Testes E2E de interface (Playwright).
