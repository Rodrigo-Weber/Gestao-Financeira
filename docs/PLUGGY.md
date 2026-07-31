# Integração Pluggy

## 1. Objetivo

A integração importa os dados bancários pessoais já autorizados no Meu Pluggy. No fluxo atual, a instituição é conectada fora do Weber Financeiro e o `Item ID` resultante é vinculado em **Configurações → Open Finance pessoal**.

## 2. Estado

- Backend, banco e interface implementados.
- Sandbox validado.
- Contas, cartões, transações, empréstimos e investimentos suportados.
- Produção depende da liberação da Pluggy e das credenciais correspondentes.

## 3. Credenciais e identificadores

| Valor | Onde fica | Motivo |
| --- | --- | --- |
| `PLUGGY_CLIENT_ID` | `.env`/Netlify | Credencial privada da aplicação |
| `PLUGGY_CLIENT_SECRET` | `.env`/Netlify | Segredo privado da aplicação |
| `PLUGGY_BASE_URL` | `.env`/Netlify | Endpoint configurável |
| `PLUGGY_MODE` | `.env`/Netlify | Marcador interno sandbox/personal |
| `Item ID` | `financial_connections` | Identifica a conexão do usuário |
| `Connection ID` | Banco e frontend | Identifica o vínculo dentro do Weber |

Nunca use prefixo `VITE_` nas credenciais Pluggy. Variáveis `VITE_*` entram no bundle do navegador.

## 4. Configuração

```env
PLUGGY_CLIENT_ID=seu-client-id
PLUGGY_CLIENT_SECRET=seu-client-secret
PLUGGY_BASE_URL=https://api.pluggy.ai
PLUGGY_MODE=sandbox
```

Depois:

1. aplique as migrations `002` e `003`;
2. reinicie `npx netlify dev`;
3. abra Configurações;
4. teste as credenciais;
5. vincule um `Item ID`;
6. execute a sincronização.

O `Item ID` não deve ficar no `.env`, porque pertence a um usuário, pode mudar e pode existir mais de um por conta.

## 5. Comunicação

```mermaid
sequenceDiagram
    participant SPA as Weber SPA
    participant FN as Netlify Function
    participant AUTH as Supabase Auth
    participant DB as PostgreSQL
    participant PL as Pluggy API

    SPA->>FN: Request + Bearer JWT
    FN->>AUTH: getUser(JWT)
    AUTH-->>FN: user.id
    FN->>DB: Busca conexão por id + user_id
    FN->>PL: POST /auth
    PL-->>FN: API Key temporária
    FN->>PL: Consulta item e produtos
    PL-->>FN: Dados bancários
    FN->>DB: Upsert com user_id + connection_id
    FN-->>SPA: Contadores e status
```

### Autenticação Pluggy

O cliente server-side troca `Client ID` e `Client Secret` por uma API Key temporária. A chave fica em cache no processo da Function. Se a Pluggy responder `401`, o cache é invalidado e a chamada é repetida uma vez.

## 6. Endpoints internos

### `POST /api/pluggy-health`

Valida se as credenciais conseguem autenticar na Pluggy.

### `GET /api/pluggy-connections`

Lista conexões do usuário, status, produtos, última sincronização e último erro.

### `POST /api/pluggy-connections`

Valida o `Item ID`, consulta uma prévia e cria ou reativa a conexão.

Corpo:

```json
{
  "itemId": "uuid-do-item",
  "displayName": "Banco pessoal"
}
```

### `PATCH /api/pluggy-connections`

Valida o novo item, atualiza a conexão e remove os dados importados do item anterior.

```json
{
  "connectionId": "uuid-da-conexao",
  "itemId": "novo-uuid-do-item",
  "displayName": "Conta pessoal"
}
```

### `DELETE /api/pluggy-connections`

```json
{
  "connectionId": "uuid-da-conexao",
  "mode": "disconnect"
}
```

`disconnect` preserva os dados. `delete` apaga os registros vinculados àquela conexão.

### `POST /api/pluggy-sync`

```json
{
  "connectionId": "uuid-da-conexao"
}
```

Importa e reconcilia todos os produtos suportados.

## 7. Mapeamento

| Pluggy | Weber Financeiro | Observação |
| --- | --- | --- |
| Conta `BANK` | `accounts` | Saldo e instituição |
| Conta `CREDIT` | `credit_cards` | Limite, fechamento e vencimento |
| Transaction | `transactions` | Tipo, status, datas e origem |
| Loan | `debts` | Saldo, parcela, CET e prazo |
| Investment | `investments` | Saldo, quantidade, rentabilidade e vencimento |

Cada registro importado recebe:

- `external_provider = 'pluggy'`;
- `external_id`;
- `connection_id`;
- data de importação;
- metadados quando necessários.

## 8. Idempotência e consistência

### Upsert

IDs externos são reutilizados. Sincronizar novamente atualiza o registro existente, em vez de criar cópia.

### Paginação

As transações são lidas por conta, seguindo o link `next`. O limite defensivo é de 40 páginas, até 20 mil transações conforme o tamanho esperado de página.

### Batches

Gravações usam lotes de 250 registros para reduzir payload e tempo de transação.

### Limpeza

Depois do upsert, IDs externos que existiam localmente e não vieram mais da Pluggy são removidos. A consulta sempre restringe `user_id`, `connection_id` e `external_provider`.

### Conciliação

O saldo inicial local é ajustado para que o saldo calculado a partir das transações corresponda ao saldo reportado pela instituição.

### Cartões

Compras são registradas como `card_purchase`; pagamento de fatura usa `invoice_payment`. Os cálculos evitam contar os dois como despesas independentes.

## 9. Sincronização automática

Ao iniciar uma sessão, a aplicação:

1. carrega os dados locais;
2. lista conexões;
3. identifica conexões ativas sem sincronização nas últimas seis horas;
4. sincroniza uma a uma;
5. recarrega os dados se alguma execução ocorreu.

A sincronização manual continua disponível em Configurações.

## 10. Sandbox para produção

Fluxo recomendado:

1. mantenha a conexão sandbox enquanto valida a aplicação;
2. obtenha a liberação de produção;
3. configure as credenciais de produção na Netlify;
4. conecte as contas reais pelo Meu Pluggy;
5. use **Substituir** na conexão sandbox;
6. sincronize;
7. confira saldos, cartões, dívidas, investimentos e categorias.

Não edite o `Item ID` diretamente no banco. O fluxo de substituição valida o item antes da limpeza.

## 11. Diagnóstico

| Sintoma | Verificação |
| --- | --- |
| Credenciais não configuradas | Confirme variáveis e reinicie Netlify Dev |
| `401` da Pluggy | Revogue/regenere credenciais e teste novamente |
| Item não encontrado | Confirme ambiente e UUID |
| Nenhuma conta retornada | Verifique status do item no dashboard Pluggy |
| Dados duplicados | Confira índices externos e `connection_id` |
| Empréstimos ausentes | Confirme suporte do conector ao produto Loans |
| Investimentos ausentes | Confirme suporte do conector a Investments |
| Sync permanece com erro | Consulte `last_error` e `financial_sync_runs` |
| Saldo divergente | Revise conciliação e transações removidas na origem |

## 12. Segurança

- Credenciais nunca retornam ao frontend.
- Todo endpoint valida o JWT.
- Toda conexão é buscada por `id` e `user_id`.
- Exclusão atua somente sobre o `connection_id` escolhido.
- Mensagens públicas evitam expor detalhes sensíveis.
- O histórico de execução registra sucesso, falha e contadores.

Consulte também [Segurança](SECURITY.md).
## 13. Cartões, limites e faturas (atualizado em 30/07/2026)

O limite exibido pela tela **Cartões** segue esta prioridade: linha consolidada de `creditData.disaggregatedCreditLimits` (`usedAmount`, `availableAmount` e `limitAmount`); depois os campos de `creditData`; por fim, o cálculo local das compras conhecidas apenas como fallback para cartões manuais ou conectores incompletos. Isso evita confundir compras do mês com limite comprometido por faturas anteriores ou parcelas futuras. Consulte [Account](https://docs.pluggy.ai/docs/accounts).

Quando disponível, a sincronização consulta `GET /bills?accountId=...` e grava faturas, pagamentos, encargos, valor mínimo e vencimento em `card_invoices`. Conectores sem esse produto não interrompem o restante da sincronização. Referências: [Credit Card Bills](https://docs.pluggy.ai/docs/credit-card-bills) e [Bills List](https://docs.pluggy.ai/reference/bills-list).

## 14. Transações e recorrências

Transações usam a paginação cursor-based de `GET /v2/transactions`. `PENDING` representa faturas abertas ou parcelas futuras e não deve ser tratado como dinheiro liquidado. Referência: [Transaction](https://docs.pluggy.ai/docs/transactions) e [List by Cursor](https://docs.pluggy.ai/reference/transactions-list-by-cursor).

A tela **Recorrentes** usa dados locais e aplica os critérios descritos pela Pluggy: pelo menos três ocorrências, intervalo mensal aproximado (25–35 dias), variação de valor de até 10% e índice de regularidade. Ela não depende do recurso premium. Referência: [Recurring Payments Analysis](https://docs.pluggy.ai/docs/recurring-payments-1).

## 15. Empréstimos

Empréstimos são um produto separado da Pluggy e só aparecem quando a instituição conectada oferece cobertura de Loans. A sincronização consulta `GET /loans?itemId=...` e importa contrato, saldo devedor, CET anual, taxa, sistema de amortização, periodicidade, total de parcelas, parcelas pagas/restantes e parcelas vencidas. A tela **Dívidas** mostra esses dados e identifica a origem Pluggy. A documentação também prevê tarifas contratadas, garantias, pagamentos/releases e parcelas extraordinárias; esses detalhes ficam preservados no payload/metadata para uma próxima tela de contrato detalhado. Referências: [Loan](https://docs.pluggy.ai/docs/loans) e [Loans List](https://docs.pluggy.ai/reference/loans-list).

Foi corrigida a leitura das grafias oficiais `firstInstalmentDueDate`, `instalmentPeriodicity` e `pastDueInstalments`, mantendo compatibilidade com payloads legados que usam a grafia alternativa.

## 16. Migration necessária

Execute `supabase/migrations/202607300004_pluggy_credit_details.sql` após as migrations anteriores. Ela adiciona metadados de limite e campos de fatura de forma aditiva, sem apagar dados existentes.

## 17. Webhook em produção (Netlify)

Endpoint público:

```text
https://weberfinanceiro.com.br/api/pluggy-webhook
```

O domínio personalizado aponta para a mesma implantação Netlify; a Function `pluggy-webhook.mts` declara esse caminho público. O receptor valida `PLUGGY_WEBHOOK_SECRET`, registra o `eventId` de forma idempotente, dispara `pluggy-webhook-worker` como Background Function e responde `202` rapidamente. Uma Scheduled Function busca falhas a cada 15 minutos com backoff.

Variável obrigatória na Netlify:

```text
PLUGGY_WEBHOOK_SECRET=<segredo-aleatorio-longo>
```

Cadastre o webhook pela API Pluggy, pois headers secretos só podem ser configurados via API:

```json
{
  "url": "https://weberfinanceiro.com.br/api/pluggy-webhook",
  "event": "all",
  "headers": {
    "Authorization": "Bearer <mesmo-PLUGGY_WEBHOOK_SECRET>"
  }
}
```

O request de criação é `POST https://api.pluggy.ai/webhooks` com a API Key Pluggy em `X-API-KEY`. A Pluggy exige HTTPS, resposta em menos de cinco segundos e pode entregar o mesmo evento até nove vezes; por isso `eventId` é único no banco. Eventos de item/transação disparam sincronização completa consistente; eventos de erro atualizam a conexão e ficam visíveis operacionalmente.

## 18. Confiabilidade financeira

A migration `202607310005_financial_reliability.sql` adiciona:

- fila e histórico de webhooks;
- lock contra sincronizações concorrentes;
- valor/tipo original da transação;
- `card_credit` para estornos, cashback e créditos;
- preferências confirmadas, ignoradas ou canceladas de recorrências;
- conciliações e histórico de alterações externas.

Compras são vinculadas à fatura oficial quando a Pluggy fornece datas de fechamento. Créditos reduzem limite utilizado e gasto por categoria, sem serem tratados como nova despesa.
