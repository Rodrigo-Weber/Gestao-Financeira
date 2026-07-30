# Roadmap de Saúde Financeira

Última atualização: 30/07/2026

Este arquivo é a fonte de verdade da evolução financeira do Weber Financeiro.

## Legenda

- [x] Concluído
- [ ] Pendente
- **Em andamento**: implementação ativa
- **Adiado**: depende de integração externa

## Base já concluída

- [x] Resumo de saldo realizado e projetado
- [x] Receitas e despesas realizadas e pendentes
- [x] Fluxo de caixa mensal
- [x] Gastos por categoria
- [x] Orçamentos mensais por categoria
- [x] Ritmo de contas pagas, pendentes e atrasadas
- [x] Saldos separados por conta
- [x] Controle de cartões, faturas e limite utilizado
- [x] Compra no cartão separada do pagamento da fatura
- [x] Controle e simulador de quitação de dívidas
- [x] Próximos vencimentos
- [x] Relatórios visuais e exportações PDF, Excel e CSV
- [x] Dashboard responsivo para PC e celular
- [x] Transações em formato de cartões no celular

## P0 — Decisões financeiras diárias

- [x] **Dinheiro livre até a próxima renda**
  - Saldo líquido atual
  - Compromissos antes da próxima entrada
  - Valor livre total
  - Limite semanal sugerido
  - Aviso de insuficiência de saldo

- [x] **Central de alertas financeiros**
  - Contas atrasadas
  - Saldo insuficiente
  - Orçamento acima do limite
  - Ritmo de gasto elevado
  - Cartão próximo do limite

- [x] Calendário financeiro diário
  - Receitas, contas, cartões e dívidas
  - Destaque de dias com risco de saldo negativo

- [x] Previsão de caixa para 30, 60 e 90 dias
  - Menor saldo previsto
  - Primeiro dia com saldo negativo
  - Entradas e saídas futuras

- [x] Classificação de gastos
  - Essenciais
  - Fixos
  - Flexíveis
  - Eventuais

- [x] Separação entre renda recorrente e renda eventual

- [x] Orçamento ajustado ao tempo do mês
  - Percentual do orçamento usado
  - Percentual do mês transcorrido
  - Ritmo normal, atenção ou acima do esperado

## P1 — Proteção e planejamento

- [x] Reserva de emergência
  - Meta configurável
  - Valor acumulado
  - Meses de despesas essenciais cobertos
  - Aporte mensal necessário
  - Previsão de conclusão

- [x] Fundos para despesas anuais
  - IPVA
  - IPTU
  - Seguros
  - Matrículas
  - Manutenção
  - Presentes e viagens

- [x] Metas financeiras
  - Valor e prazo
  - Progresso
  - Aporte recomendado
  - Prioridade

- [x] Patrimônio líquido
  - Contas
  - Investimentos informados manualmente
  - Outros ativos
  - Dívidas
  - Evolução mensal

- [x] Diagnóstico completo de dívidas
  - Saldo e taxa
  - Custo futuro dos juros
  - Data estimada de quitação
  - Economia com pagamentos extras

- [x] Comprometimento mensal da renda
  - Despesas fixas
  - Dívidas
  - Margem realmente livre

## P2 — Inteligência financeira

- [x] Detecção de assinaturas e cobranças recorrentes
- [x] Custo mensal e anual de assinaturas
- [x] Comparação com média móvel de três meses
- [x] Detecção de gasto incomum
- [x] Simulador de compra
  - À vista ou parcelado
  - Impacto no caixa
  - Impacto nas metas
- [x] Simulador de aportes para metas
- [x] Planejamento anual consolidado
- [x] Revisão financeira mensal guiada
- [x] Lembrete anual para auditoria pelo Registrato

## Qualidade financeira do backend

- [x] Valores monetários críticos armazenados como `NUMERIC`
- [x] Separar data de competência e vencimento
- [x] Evitar dupla contagem de compra e fatura do cartão
- [x] Idempotência completa para importações e recorrências
- [x] Conciliação entre saldo informado e saldo calculado
- [x] Histórico de alterações financeiras
- [x] Testes de parcelas, cartões, transferências e saldos
- [x] Testes de previsão, metas e reserva
- [x] Testes de dinheiro livre e alertas
- [x] RLS no Supabase
- [x] Rotina documentada de backup e recuperação
- [x] Exportação dos dados financeiros

## Experiência visual

- [x] Tela “Hoje” respondendo em menos de 10 segundos:
  - Quanto tenho?
  - Quanto posso gastar?
  - O que vence?
  - Estou melhorando?
  - Como estão reserva, dívidas e patrimônio?

- [x] Layout amplo e denso no PC
- [x] Gráficos empilhados e legíveis no celular
- [x] Navegação inferior no celular
- [x] Opção para ocultar valores sensíveis
- [x] Área simplificada “Hoje”
- [x] Áreas separadas “Planejar” e “Patrimônio”
- [x] Explicação simples para cada indicador
- [x] Nenhum gráfico sem ação ou decisão associada

## Integrações externas

- [x] Open Finance pessoal via Meu Pluggy — **Pronto para produção**
  - [x] Pesquisa de viabilidade e limites do plano gratuito
  - [x] Estrutura de conexões e sincronizações
  - [x] IDs externos e proteção contra duplicidade
  - [x] Cliente Pluggy seguro no backend
  - [x] Aplicar migração no Supabase
  - [x] Validar credenciais
  - [x] Tela e backend seguro para vincular `Item ID`
  - [x] Cadastrar `Item ID` sandbox pelo usuário
  - [x] Implementar importação de contas, cartões e transações
  - [x] Executar e conferir a primeira sincronização
  - [x] Importar empréstimos
  - [x] Importar investimentos
  - [x] Desconectar mantendo histórico
  - [x] Excluir dados importados por conexão
  - [x] Substituir Item ID sem duplicar o sandbox
- [x] Importação bancária automática ao abrir o aplicativo
- [x] Sincronização automática de investimentos

Uso comercial e conexão bancária direta dentro do Weber continuam adiados. A
integração atual será limitada às contas pessoais já autorizadas no Meu Pluggy.

## Dependências externas restantes

1. Aprovação/liberação da Pluggy para dados pessoais de produção.
2. Configurar as mesmas credenciais seguras no ambiente de produção da Netlify.
3. Conectar as contas pessoais pelo Meu Pluggy e cadastrar os novos `Item ID`.
4. Executar a primeira sincronização real e conferir os saldos.

## Histórico de entregas

### 30/07/2026 — Dinheiro livre e alertas

- [x] Cálculo de saldo disponível após compromissos
- [x] Busca da próxima renda cadastrada
- [x] Limite semanal estimado
- [x] Aviso de insuficiência de saldo
- [x] Alertas de contas atrasadas
- [x] Alertas de projeção negativa
- [x] Alertas de orçamento estourado ou acelerado
- [x] Alertas de cartão próximo do limite
- [x] Painel responsivo no topo do dashboard
- [x] Testes automatizados das novas regras

### 30/07/2026 — Saúde financeira completa e Pluggy

- [x] Áreas Hoje, Planejar e Patrimônio
- [x] Previsão diária de caixa em 30, 60 e 90 dias
- [x] Reserva, metas e fundos anuais
- [x] Assinaturas, gastos incomuns e revisão mensal
- [x] Simulador de compra e comprometimento da renda
- [x] Patrimônio líquido e evolução mensal
- [x] Empréstimos e investimentos Pluggy
- [x] Sincronização automática ao abrir o aplicativo
- [x] Histórico financeiro e documentação de recuperação
