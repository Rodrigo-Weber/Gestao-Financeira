# Integração Pluggy — Preparação

Última atualização: 30/07/2026

## Estado atual

- [x] Conta Pluggy criada
- [x] `Client ID` disponível
- [x] `Client Secret` disponível
- [x] Credenciais configuradas localmente
- [x] Migração `202607300002_pluggy_sync.sql` aplicada no Supabase
- [ ] Migração `202607300003_financial_health.sql` aplicada no Supabase
- [x] Credenciais validadas pelo backend
- [x] Conta sandbox criada
- [x] `Item ID` sandbox disponível
- [x] `Item ID` cadastrado no Weber Financeiro
- [x] Primeira sincronização executada

## Dados necessários

### Já disponíveis

- `PLUGGY_CLIENT_ID`
- `PLUGGY_CLIENT_SECRET`

Esses valores devem ser cadastrados diretamente no arquivo `.env` local e,
posteriormente, nas variáveis de ambiente da Netlify. Nunca devem ser enviados
por chat, salvos no frontend ou usar prefixo `VITE_`.

### Ainda necessários para dados reais

- `Item ID` de cada conta autorizada pelo conector MeuPluggy
- Nome amigável da conexão, por exemplo `Nubank pessoal`
- Confirmação de quais contas serão importadas

O `Item ID` não é senha. Ele identifica a conexão dentro da API Pluggy e será
salvo na tabela `financial_connections`, associado ao usuário autenticado.
Não deve ficar no `.env`: cada usuário pode ter vários itens, e itens sandbox
podem ser substituídos ou mantidos ao lado das conexões pessoais.

## Variáveis de ambiente

```env
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_BASE_URL=https://api.pluggy.ai
PLUGGY_MODE=sandbox
```

Quando os dados pessoais reais estiverem vinculados pelo conector MeuPluggy,
`PLUGGY_MODE` poderá mudar para:

```env
PLUGGY_MODE=personal
```

`PLUGGY_MODE` é somente um marcador interno. A API base continua
`https://api.pluggy.ai`.

## Fluxo gratuito para uso pessoal

1. Conectar bancos em `meu.pluggy.ai`.
2. Abrir aplicação em `dashboard.pluggy.ai`.
3. Escolher conector MeuPluggy.
4. Entrar no Meu Pluggy e autorizar cada conta.
5. Obter o `Item ID` criado.
6. Cadastrar conexão no Weber Financeiro.
7. Executar sincronização.

No plano pessoal, a instituição não é conectada diretamente dentro do Weber.
O Weber recebe os dados das contas já autorizadas no Meu Pluggy.

## Estrutura preparada

### Banco de dados

- `financial_connections`: itens Pluggy vinculados ao usuário
- `financial_sync_runs`: histórico de sincronizações
- IDs externos em contas, cartões, faturas e transações
- `investments`: posições de investimento importadas
- Índices únicos para impedir duplicidade
- RLS para isolamento por usuário

### Backend

- Cliente Pluggy somente no servidor
- API Key temporária em cache
- Renovação após resposta `401`
- Timeouts de rede
- Endpoint autenticado `POST /api/pluggy-health`
- Endpoint autenticado `GET/POST /api/pluggy-connections`
- Endpoint autenticado `POST /api/pluggy-sync`
- Validação do `Item ID` na Pluggy antes de salvar
- Cadastro e listagem das conexões em Configurações
- Desconexão com preservação do histórico
- Exclusão isolada dos dados importados por conexão
- Substituição segura do Item ID após validação do novo item
- Importação idempotente de contas, cartões e transações
- Importação idempotente de empréstimos e investimentos
- Paginação completa de até 20 mil transações por conta
- Conciliação do saldo inicial com o saldo atual informado pelo banco
- Remoção segura de transações Pluggy que desapareceram da origem
- Remoção segura de contas, cartões, empréstimos e investimentos obsoletos
- Histórico de cada execução em `financial_sync_runs`
- Nenhuma credencial retornada ao frontend

## Estratégia da primeira importação

- Importar até 12 meses quando disponíveis
- Criar contas e cartões Pluggy sem apagar itens manuais
- Copiar transações usando `external_id`
- Atualizar registros existentes por `upsert`
- Manter categorias Weber como fonte principal
- Guardar categoria Pluggy apenas como sugestão
- Importar parcelas futuras quando a instituição fornecer
- Não gerar dívida, meta ou recorrência automaticamente sem confirmação
- Não contabilizar compra no cartão e pagamento de fatura como duas despesas

## Próximas etapas técnicas

1. Aplicar `202607300003_financial_health.sql`.
2. Sincronizar novamente para importar empréstimos e investimentos.
3. Conferir saldos, cartões, empréstimos, investimentos e categorias.
4. Aguardar liberação da Pluggy para dados pessoais.
5. Configurar credenciais na Netlify e cadastrar os Item IDs reais.

## Troca do sandbox pela conta pessoal

Em `Configurações > Open Finance pessoal`:

- **Desconectar** pausa a sincronização e mantém tudo que já foi importado.
- **Excluir dados** remove a conexão e somente registros ligados ao Item ID.
  Registros manuais são preservados.
- **Substituir** valida o novo Item ID, troca a conexão e limpa os dados
  importados do item anterior. Depois, basta sincronizar novamente.

A exclusão total exige digitar `EXCLUIR` para evitar remoção acidental.
