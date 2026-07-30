# Referência de API

## 1. Convenções

As APIs são Netlify Functions expostas por `/api/*` através do redirect configurado em `netlify.toml`.

### Autenticação

Todas as rotas exigem:

```http
Authorization: Bearer <supabase-access-token>
```

O token é validado pelo Supabase Auth. Ausência ou expiração retorna `401`.

### Idempotência

O helper do frontend adiciona a operações não GET:

```http
X-Idempotency-Key: <uuid>
```

As rotas de IA que podem gerar ações reservam a chave em `ai_requests`. Repetições retornam `409`.

### Formato

Respostas JSON:

```http
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

Erro padrão:

```json
{
  "error": "Mensagem segura para o usuário."
}
```

### Códigos comuns

| Status | Significado |
| --- | --- |
| `200` | Operação concluída |
| `400` | Payload inválido |
| `401` | Sessão ausente ou inválida |
| `404` | Recurso não encontrado no escopo do usuário |
| `405` | Método não permitido |
| `409` | Conflito ou repetição idempotente |
| `413` | Arquivo acima do limite |
| `502` | Falha em serviço externo ou persistência |
| `503` | Integração não configurada |

## 2. IA

### `POST /api/ai-health`

Valida autenticação e disponibilidade do modelo de chat.

Resposta:

```json
{
  "ok": true,
  "provider": "Groq",
  "model": "groq/compound",
  "latencyMs": 420
}
```

### `POST /api/ai-chat`

Recebe uma mensagem e até 12 mensagens de histórico.

```json
{
  "message": "Quanto gastei com alimentação?",
  "history": [
    {
      "role": "user",
      "content": "Analise meu mês."
    }
  ]
}
```

Limites:

- mensagem: 1 a 2.000 caracteres;
- histórico: até 12 itens;
- contexto financeiro: até 500 transações recentes, além de contas, cartões, categorias, dívidas e orçamentos.

Tipos de resposta:

- resposta textual;
- rascunho de lançamento;
- candidatos para edição;
- candidatos para exclusão.

A Function não altera transações. Ela devolve uma proposta para confirmação no frontend.

### `POST /api/ai-transaction`

Extrai um lançamento de uma imagem.

```json
{
  "image": "data:image/jpeg;base64,...",
  "mimeType": "image/jpeg"
}
```

Formatos: JPEG, PNG e WebP. Limite efetivo: 8 MB.

Resposta:

```json
{
  "draft": {
    "description": "Mercado",
    "amount": 125.9,
    "kind": "expense",
    "date": "2026-07-30",
    "installments": 1,
    "paymentMethod": "pix",
    "confidence": 0.93
  },
  "attachmentPath": "user-id/arquivo.jpg"
}
```

O comprovante é armazenado no bucket privado `receipts`. Se a interpretação falhar, o arquivo recém-enviado é removido.

### `POST /api/transcribe`

Recebe `multipart/form-data`:

```text
audio: File
```

Limite: 12 MB.

Resposta:

```json
{
  "text": "Paguei oitenta reais no mercado por pix."
}
```

O áudio é enviado para transcrição e não é persistido pelo Weber.

## 3. Pluggy

### `POST /api/pluggy-health`

Valida credenciais e consulta conectores sandbox.

```json
{
  "ok": true,
  "provider": "Pluggy",
  "mode": "sandbox",
  "sandboxConnectors": 12,
  "latencyMs": 380
}
```

### `GET /api/pluggy-connections`

Resposta:

```json
{
  "connections": [
    {
      "id": "connection-uuid",
      "itemId": "item-uuid",
      "displayName": "Banco pessoal",
      "status": "active",
      "products": ["ACCOUNTS", "CREDIT_CARDS"],
      "lastSyncedAt": "2026-07-30T15:00:00.000Z",
      "lastError": null
    }
  ]
}
```

### `POST /api/pluggy-connections`

```json
{
  "itemId": "item-uuid",
  "displayName": "Banco pessoal"
}
```

Valida o item antes de persistir e retorna uma prévia das contas.

### `PATCH /api/pluggy-connections`

```json
{
  "connectionId": "connection-uuid",
  "itemId": "novo-item-uuid",
  "displayName": "Conta real"
}
```

Valida o novo item, atualiza a conexão e limpa dados importados pelo item anterior.

### `DELETE /api/pluggy-connections`

```json
{
  "connectionId": "connection-uuid",
  "mode": "disconnect"
}
```

Modos:

- `disconnect`: pausa a sincronização e preserva dados;
- `delete`: remove conexão e registros importados associados.

### `POST /api/pluggy-sync`

```json
{
  "connectionId": "connection-uuid"
}
```

O resultado inclui status e contadores da execução. O histórico detalhado fica em `financial_sync_runs`.

Veja [Integração Pluggy](PLUGGY.md) para o algoritmo completo.

## 4. Acesso direto ao Supabase

CRUD financeiro comum não passa por Functions. O frontend usa o cliente Supabase com JWT e RLS para:

- perfis;
- contas;
- categorias;
- cartões;
- transações;
- dívidas;
- orçamentos;
- metas;
- fundos anuais;
- ativos;
- snapshots.

Essa escolha evita criar uma API duplicada. A política RLS é parte obrigatória do contrato.

## 5. Evolução do contrato

Ao adicionar uma rota:

1. limite métodos HTTP;
2. autentique antes de acessar dados;
3. valide payload no servidor;
4. filtre por `user_id`;
5. use idempotência quando houver mutação;
6. não retorne segredo ou erro interno;
7. documente request, response e erros;
8. adicione testes para transformação crítica.
