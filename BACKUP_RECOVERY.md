# Backup e recuperação — Weber Financeiro

Última atualização: 30/07/2026

## Política recomendada

- Backup diário do banco Supabase.
- Exportação mensal em CSV/Excel pelo próprio Weber.
- Cópia do projeto e migrations no Git.
- Nunca incluir `.env`, chaves ou tokens no backup do repositório.
- Testar uma restauração a cada três meses.

## Backup manual antes de mudanças importantes

1. Abra o projeto no Supabase.
2. Acesse `Database > Backups` e confirme o backup mais recente.
3. Gere uma exportação lógica pelo Supabase CLI:

```bash
supabase db dump --project-ref SEU_PROJECT_REF --data-only -f backup-data.sql
supabase db dump --project-ref SEU_PROJECT_REF --schema-only -f backup-schema.sql
```

4. Guarde os arquivos em armazenamento privado e criptografado.
5. Exporte também os relatórios CSV/Excel do Weber para conferência humana.

## Recuperação

1. Crie um projeto Supabase temporário.
2. Aplique todas as migrations em ordem.
3. Restaure `backup-data.sql` no ambiente temporário.
4. Confira totais de contas, transações, cartões, dívidas, investimentos e metas.
5. Teste login, RLS, relatórios e sincronização Pluggy.
6. Somente depois restaure no ambiente definitivo.

## Conferência mínima

- Quantidade de usuários.
- Quantidade e soma das transações por usuário.
- Saldos atuais das contas.
- Dívidas e investimentos.
- Metas e fundos anuais.
- Última sincronização Pluggy.
- Registros em `financial_audit_log`.

## Incidente com credenciais

Se uma chave vazar:

1. Revogue imediatamente na Pluggy, Supabase, Groq ou Netlify.
2. Gere uma nova chave.
3. Atualize somente as variáveis seguras do ambiente.
4. Revise logs e `financial_audit_log`.
5. Nunca tente corrigir apenas removendo a chave de um commit já publicado.
