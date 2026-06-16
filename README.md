# Lapidados Club App

Monolito Next.js para gestão de nutrição esportiva. Dois perfis: **Nutricionista** (painel desktop escuro) e **Paciente** (app mobile claro).

---

## Stack

- **Next.js 15** — App Router, Server Components, API Routes
- **Supabase** — Postgres, Auth, Storage, RLS
- **Tailwind CSS** — Design system com tokens da marca
- **TypeScript** — tipagem completa
- **Vercel** — deploy

---

## Setup local

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

Renomeie `.env.local` e preencha com suas keys do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://guxsfjfqywebglymasao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
GEMINI_API_KEY=sua_gemini_key
```

As keys estão em: Supabase Dashboard → Settings → API.

### 3. Executar migration no Supabase

Abra o arquivo `supabase-migration.sql` e execute **todo o conteúdo** no SQL Editor do Supabase (Dashboard → SQL Editor → New query).

> ⚠️ Seguro: a migration só **adiciona** tabelas novas. Não altera o LAPIDADOS_CONTROL nem o LAPIDADOS_CLUB_FORMS.

### 4. Criar usuário nutri

No Supabase Dashboard → Authentication → Users → Add user, crie seu usuário com email e senha.

Depois pegue o UUID desse usuário e execute:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('SEU_UUID_AQUI', 'nutri');
```

### 5. Linkar paciente existente ao Auth

Para seu paciente ativo ter login, crie um usuário para ele no Supabase Auth, depois:

```sql
UPDATE patients
SET user_id = 'UUID_DO_PACIENTE_NO_AUTH'
WHERE id = 'ID_DO_PACIENTE_NA_TABELA_PATIENTS';

INSERT INTO user_roles (user_id, role)
VALUES ('UUID_DO_PACIENTE_NO_AUTH', 'paciente');
```

### 6. Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:3000` → redireciona para `/auth/login`.

---

## Estrutura de rotas

```
/auth/login          → Login único (redireciona por role)
/(nutri)/dashboard   → Painel do nutricionista
/(nutri)/pacientes   → Lista de pacientes
/(nutri)/pacientes/[id] → Ficha do paciente
/(nutri)/checkins    → Inbox de check-ins
/(nutri)/dietas      → Editor de dietas (fase 2)
/(nutri)/treinos     → Editor de treinos (fase 2)
/(nutri)/financeiro  → Gestão financeira
/(nutri)/membros     → Área de membros (fase 2)
/(paciente)/inicio   → Dashboard do aluno
/(paciente)/dieta    → Plano alimentar
/(paciente)/treino   → Plano de treino
/(paciente)/checkin  → Formulário de check-in semanal
/(paciente)/evolucao → Histórico e gráficos
/(paciente)/conquistas → Gamificação e ranking
```

---

## Deploy no Vercel

1. Suba o repo no GitHub como `lapidadosclubapp`
2. No Vercel, importe o projeto
3. Configure as variáveis de ambiente (mesmas do `.env.local`)
4. Deploy automático a cada push na `main`

---

## Roadmap de fases

- [x] **Fase 0** — Setup, auth, layouts, design system
- [x] **Fase 1** — CRM de pacientes, check-ins, financeiro (migrado do CONTROL)
- [x] **Fase 1** — App do paciente: início, check-in, gamificação, evolução
- [ ] **Fase 2** — Editor de dieta (refeições, macros, drag&drop)
- [ ] **Fase 3** — Editor de treino (exercícios, séries, vídeos)
- [ ] **Fase 4** — IA de análise (Gemini após check-in)
- [ ] **Fase 5** — Área de membros (conteúdos, vídeos, acesso por plano)
- [ ] **Fase 6** — Convidar pacientes por email (magic link)
- [ ] **Fase 7** — PWA, notificações push

---

## Design tokens principais

| Token | Valor |
|-------|-------|
| Laranja (brand) | `#E85D04` |
| Fundo paciente | `#FAFAFA` |
| Card | `#FFFFFF` |
| Texto | `#111111` |
| Sidebar nutri | `#18181B` |
