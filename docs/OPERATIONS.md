# Operação e deploy

## 1. Ambientes

| Ambiente | Frontend | Functions | Dados externos |
| --- | --- | --- | --- |
| Local UI | `npm run dev` | Não | Demo ou Supabase direto |
| Local completo | `npx netlify dev` | Sim | Sandbox recomendado |
| Produção | Netlify | Netlify Functions | Credenciais de produção |

## 2. Variáveis de ambiente

### Frontend

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL pública do projeto |
| `VITE_SUPABASE_ANON_KEY` | Chave pública protegida por RLS |

### Functions

| Variável | Uso |
| --- | --- |
| `SUPABASE_URL` | Acesso server-side ao Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações privilegiadas após autenticação |
| `GROQ_API_KEY` | IA, visão e transcrição |
| `GROQ_CHAT_MODEL` | Modelo principal de chat |
| `GROQ_VISION_MODEL` | Extração de comprovantes |
| `GROQ_TRANSCRIBE_MODEL` | Transcrição de áudio |
| `PLUGGY_CLIENT_ID` | Identificação privada Pluggy |
| `PLUGGY_CLIENT_SECRET` | Segredo privado Pluggy |
| `PLUGGY_WEBHOOK_SECRET` | Segredo Bearer compartilhado somente entre Pluggy e Netlify |
| `PLUGGY_BASE_URL` | Base da API Pluggy |
| `PLUGGY_MODE` | Marcador sandbox/personal |

Somente URL e `anon key` do Supabase podem usar `VITE_`. Nunca exponha `service_role`, Groq ou Pluggy.

## 3. Setup local

```bash
npm install
```

Crie `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Execute:

```bash
npx netlify dev
```

URL padrão: `http://localhost:8888`.

## 4. Migrations

Execute todos os arquivos em ordem:

| Ordem | Migration | Conteúdo |
| --- | --- | --- |
| 1 | `202607290001_initial_schema.sql` | Entidades financeiras, Auth, RLS e Storage |
| 2 | `202607300001_payment_method.sql` | PIX, débito e crédito |
| 3 | `202607300002_pluggy_sync.sql` | Conexões, sync, IDs externos e investimentos |
| 4 | `202607300003_financial_health.sql` | Metas, patrimônio, snapshots e auditoria |

Após aplicar:

1. crie um usuário de teste;
2. confirme criação automática de perfil, categorias e conta;
3. valide que outro usuário não consegue ler esses registros;
4. teste upload no bucket privado;
5. execute a suíte automatizada.

## 5. Deploy Netlify

O `netlify.toml` define:

```text
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

Passos:

1. conecte o repositório à Netlify;
2. cadastre as variáveis de ambiente;
3. execute o deploy;
4. copie a URL publicada;
5. configure a URL no Supabase Auth;
6. valide login, Functions, IA e Pluggy.

### Supabase Auth

Em **Authentication → URL Configuration**:

- use a URL de produção como `Site URL`;
- adicione produção e deploy previews em `Redirect URLs`.

## 6. Checklist de release

- [ ] `npm test` aprovado.
- [ ] `npm run build` aprovado.
- [ ] Migrations aplicadas no ambiente correto.
- [ ] Nenhuma credencial presente no diff.
- [ ] Variáveis configuradas na Netlify.
- [ ] Login e logout validados.
- [ ] Operações CRUD validadas.
- [ ] RLS testado com dois usuários.
- [ ] Pluggy testada no ambiente correto.
- [ ] Webhook `https://weberfinanceiro.com.br/api/pluggy-webhook` cadastrado com header secreto.
- [ ] Functions `pluggy-webhook-worker` e `pluggy-webhook-retry` visíveis na Netlify.
- [ ] Exportações abertas e conferidas.
- [ ] Layout conferido em desktop e celular.
- [ ] Backup confirmado antes de mudanças de schema.

## 7. Observabilidade operacional

### Onde verificar

| Evento | Fonte |
| --- | --- |
| Build e deploy | Netlify Deploys |
| Erro em Function | Netlify Function Logs |
| Login e sessão | Supabase Auth Logs |
| Consulta e banco | Supabase Logs |
| Sincronização | `financial_sync_runs` |
| Último erro Pluggy | `financial_connections.last_error` |
| Alteração financeira | `financial_audit_log` |

### Indicadores recomendados

- taxa de sucesso das sincronizações;
- duração média da sincronização;
- quantidade importada por produto;
- erros `401`, `409`, `429` e `5xx`;
- falhas de build;
- crescimento de transações e auditoria;
- tempo de resposta das Functions.

## 8. Backup

### Política recomendada

- backup diário do Supabase;
- exportação mensal pelo Weber;
- migrations preservadas no Git;
- restauração testada a cada três meses;
- arquivos de backup em armazenamento privado e criptografado.

### Antes de mudanças importantes

```bash
supabase db dump --project-ref SEU_PROJECT_REF --data-only -f backup-data.sql
supabase db dump --project-ref SEU_PROJECT_REF --schema-only -f backup-schema.sql
```

Não envie dumps ao repositório.

## 9. Recuperação

1. crie um projeto Supabase temporário;
2. aplique todas as migrations;
3. restaure o dump de dados;
4. confira usuários e totais financeiros;
5. valide RLS com contas distintas;
6. teste login, relatórios e Pluggy;
7. restaure em produção somente após a conferência.

### Conferência mínima

- quantidade de usuários;
- quantidade e soma de transações por usuário;
- saldos atuais;
- cartões e faturas;
- dívidas e investimentos;
- metas e fundos anuais;
- snapshots de patrimônio;
- última sincronização;
- integridade do audit log.

## 10. Rollback

Para frontend e Functions, publique novamente o último deploy estável da Netlify.

Para banco:

- migrations devem ser preferencialmente aditivas;
- não reverta schema com `DROP` sem backup validado;
- restaure primeiro em ambiente temporário;
- documente correções em uma nova migration.

## 11. Incidente com credenciais

1. revogue a credencial no provedor;
2. gere uma nova;
3. atualize `.env` local e Netlify;
4. gere novo deploy;
5. revise logs e auditoria;
6. invalide sessões se necessário;
7. registre causa e ações preventivas.

Remover a chave de um commit novo não elimina o histórico. Se ela entrou no Git, considere-a comprometida.

## 12. Troubleshooting

| Problema | Ação |
| --- | --- |
| Frontend abre, API falha | Use `npx netlify dev`, não apenas Vite |
| Erro de migration | Confirme ordem e ambiente |
| Login redireciona errado | Ajuste URLs no Supabase Auth |
| IA retorna 503 | Verifique `GROQ_API_KEY` e modelos |
| Pluggy retorna 503 | Verifique credenciais server-side |
| Dados não aparecem | Confira sessão, RLS e logs do Supabase |
| Build excede alerta de chunk | O build funciona; planeje mais code splitting |
| Exportação vazia | Confirme período e filtros ativos |
