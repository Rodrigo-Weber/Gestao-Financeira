# Fluxos da plataforma

Este documento descreve os principais caminhos funcionais e as fronteiras entre navegador, Supabase, Netlify, Groq e Pluggy.

## 1. Inicialização e autenticação

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant AUTH as Supabase Auth
    participant DB as PostgreSQL + RLS
    participant API as Netlify Functions

    U->>SPA: Abre a aplicação
    SPA->>AUTH: getSession()
    alt Sem sessão
        SPA-->>U: Exibe login ou demonstração
        U->>AUTH: E-mail e senha
        AUTH-->>SPA: JWT da sessão
    end
    SPA->>DB: Consultas paralelas com JWT
    DB-->>SPA: Somente registros do usuário via RLS
    SPA->>API: GET /api/pluggy-connections
    API->>AUTH: Valida JWT
    API-->>SPA: Conexões e última sincronização
    opt Conexão ativa sem sync há mais de 6 horas
        SPA->>API: POST /api/pluggy-sync
        API-->>SPA: Resultado consolidado
        SPA->>DB: Recarrega dados
    end
```

## 2. Lançamento manual

```mermaid
flowchart TD
    A[Usuário abre Novo lançamento] --> B[Informa descrição e valor]
    B --> C{Receita ou despesa?}
    C -->|Receita| D[Seleciona conta e status]
    C -->|Despesa| E{Forma de pagamento}
    E -->|PIX / débito| F[Vincula conta]
    E -->|Crédito| G[Vincula cartão]
    G --> H[Calcula fechamento e vencimento]
    D --> I[Valida campos]
    F --> I
    H --> I
    I --> J{Parcelado ou recorrente?}
    J -->|Não| K[Cria transação]
    J -->|Sim| L[Gera ocorrências preservando total]
    K --> M[Persiste no Supabase]
    L --> M
    M --> N[Atualiza indicadores e gráficos]
```

### Regras críticas

- Compras no cartão usam `card_purchase`.
- Pagamento da fatura usa `invoice_payment`.
- O fluxo de caixa ignora a compra quando a fatura já representa a saída.
- Transferências movimentam duas contas sem virar receita ou despesa.
- Parcelas preservam o valor total mesmo com arredondamento.

## 3. Consulta financeira

```mermaid
flowchart LR
    DATA[(Dados autorizados)] --> PERIOD[Período selecionado]
    PERIOD --> SUMMARY[Resumo]
    PERIOD --> FLOW[Fluxo de caixa]
    PERIOD --> CATEGORY[Gastos por categoria]
    PERIOD --> STATUS[Pagas / pendentes / atrasadas]
    DATA --> GUIDE[Dinheiro livre]
    DATA --> HEALTH[Saúde financeira]
    SUMMARY --> UI[Dashboard]
    FLOW --> UI
    CATEGORY --> UI
    STATUS --> UI
    GUIDE --> UI
    HEALTH --> UI
```

O modo **Mês** usa início e fim do mês. O modo **Intervalo** usa datas inclusivas e atravessa meses. Saldo de contas, patrimônio e dívidas representam o estado atual e não são limitados pelo filtro histórico.

## 4. Weber IA

```mermaid
sequenceDiagram
    actor U as Usuário
    participant SPA as React SPA
    participant FN as Netlify Function
    participant AUTH as Supabase Auth
    participant DB as PostgreSQL
    participant AI as Groq

    U->>SPA: Envia texto, imagem ou áudio
    SPA->>FN: Bearer JWT + idempotency key
    FN->>AUTH: Valida sessão
    FN->>DB: Reserva chave idempotente
    FN->>DB: Busca contexto do user_id
    FN->>AI: Prompt + contexto mínimo necessário
    AI-->>FN: Resposta estruturada
    FN-->>SPA: Explicação ou proposta
    alt Ação financeira
        SPA-->>U: Exibe confirmação
        U->>SPA: Confirma
        SPA->>DB: Grava alteração
    end
```

O modelo não recebe acesso a SQL nem credenciais. Alterações propostas retornam ao frontend e passam pelo fluxo normal de confirmação.

## 5. Vínculo Pluggy

```mermaid
sequenceDiagram
    actor U as Usuário
    participant MP as Meu Pluggy
    participant SPA as Weber Financeiro
    participant FN as pluggy-connections
    participant AUTH as Supabase Auth
    participant PL as Pluggy API
    participant DB as PostgreSQL

    U->>MP: Autoriza instituição financeira
    MP-->>U: Item ID
    U->>SPA: Informa Item ID e nome
    SPA->>FN: POST + JWT
    FN->>AUTH: Valida usuário
    FN->>PL: Consulta item e contas
    PL-->>FN: Item válido + produtos
    FN->>DB: Upsert financial_connections
    DB-->>FN: Connection ID
    FN-->>SPA: Prévia da conexão
```

O `Item ID` pertence à conexão e fica no banco. `Client ID` e `Client Secret` pertencem ao servidor e ficam nas variáveis de ambiente.

## 6. Sincronização Pluggy

```mermaid
flowchart TD
    A[POST /api/pluggy-sync] --> B[Validar JWT e connectionId]
    B --> C[Criar financial_sync_run]
    C --> D[Marcar conexão como syncing]
    D --> E[Buscar contas, empréstimos e investimentos]
    E --> F[Mapear IDs externos para IDs locais]
    F --> G[Upsert contas, cartões, dívidas e investimentos]
    G --> H[Buscar transações paginadas por conta]
    H --> I[Normalizar tipo, status, datas e categoria]
    I --> J[Upsert em lotes de 250]
    J --> K[Remover registros Pluggy obsoletos]
    K --> L[Reconciliar saldo inicial]
    L --> M[Concluir run e atualizar last_synced_at]
    M --> N[Frontend recarrega dados]

    E -->|Erro| X[Registrar falha]
    H -->|Erro ou limite excedido| X
    J -->|Erro| X
    X --> Y[Status error + last_error]
```

Mais detalhes em [Integração Pluggy](PLUGGY.md).

## 7. Ciclo de vida da conexão

```mermaid
stateDiagram-v2
    [*] --> active: Item validado
    active --> syncing: Iniciar sincronização
    syncing --> active: Sucesso
    syncing --> error: Falha
    error --> syncing: Tentar novamente
    active --> disconnected: Desconectar
    error --> disconnected: Desconectar
    disconnected --> active: Substituir Item ID
    active --> active: Substituir Item ID
    disconnected --> [*]: Excluir conexão e importados
    active --> [*]: Excluir conexão e importados
```

### Efeito de cada ação

| Ação | Conexão | Dados importados | Dados manuais |
| --- | --- | --- | --- |
| Sincronizar | Mantida | Atualizados | Preservados |
| Desconectar | Status `disconnected` | Preservados | Preservados |
| Substituir | Reutilizada com novo Item ID | Antigos removidos | Preservados |
| Excluir dados | Removida | Removidos | Preservados |

## 8. Exportação

```mermaid
flowchart LR
    A[Período selecionado] --> B[Filtrar transações e orçamentos]
    B --> C{Formato}
    C -->|PDF| D[jsPDF]
    C -->|Excel| E[XML + ZIP via fflate]
    C -->|CSV| F[UTF-8 + separador ponto e vírgula]
    D --> G[Download local]
    E --> G
    F --> G
```

Os arquivos são gerados no navegador. Nenhum dado é enviado para um serviço de exportação.

## 9. Exclusão segura

```mermaid
flowchart TD
    A[Usuário solicita exclusão] --> B{Tipo}
    B -->|Transação| C[Selecionar registro exato]
    B -->|Dados Pluggy| D[Selecionar conexão]
    C --> E[Confirmação e validação]
    D --> F[Digitar EXCLUIR]
    E --> G[Excluir registro do usuário]
    F --> H[Excluir apenas connection_id selecionado]
    H --> I[Excluir financial_connection]
    G --> J[Atualizar interface]
    I --> J
```
