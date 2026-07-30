# Roadmap

Última atualização: 30/07/2026.

## Estado atual

### Concluído

- [x] Dashboard responsivo e visão “Hoje”.
- [x] Contas, cartões, transações e dívidas.
- [x] Fluxo de caixa e categorias.
- [x] Período mensal e intervalo personalizado.
- [x] Orçamentos e alertas financeiros.
- [x] Dinheiro livre e limite semanal.
- [x] Reserva, metas e fundos anuais.
- [x] Previsões de 30, 60 e 90 dias.
- [x] Assinaturas e gastos incomuns.
- [x] Simulador de compra.
- [x] Patrimônio líquido e snapshots.
- [x] Simulador de quitação de dívidas.
- [x] PDF, Excel e CSV.
- [x] Privacidade de valores.
- [x] Weber IA por texto, imagem e áudio.
- [x] RLS, auditoria e recuperação documentada.
- [x] Pluggy: contas, cartões e transações.
- [x] Pluggy: empréstimos e investimentos.
- [x] Pluggy: sincronização automática.
- [x] Pluggy: desconectar, substituir e excluir.

### Dependências externas

- [ ] Liberação Pluggy para dados pessoais de produção.
- [ ] Configuração das credenciais de produção na Netlify.
- [ ] Conexão das contas pessoais reais.
- [ ] Primeira conciliação completa em produção.

## Próximas evoluções recomendadas

### P1 — Confiabilidade

- [ ] Webhooks Pluggy para atualização orientada a eventos.
- [ ] Retry exponencial e fila para sincronizações.
- [ ] Painel visual de reconciliação bancária.
- [ ] Monitoramento de erros e duração das Functions.
- [ ] Testes end-to-end dos fluxos críticos.

### P2 — Experiência

- [ ] PWA e experiência offline controlada.
- [ ] Importação OFX/CSV.
- [ ] Regras personalizadas de categorização.
- [ ] Comparativos anuais e sazonais.
- [ ] Acessibilidade validada por auditoria automatizada.

### P3 — Expansão opcional

- [ ] Compartilhamento familiar com papéis.
- [ ] Notificações configuráveis por e-mail ou push.
- [ ] Ambientes separados de staging e produção.
- [ ] Agregações server-side para grandes históricos.
- [ ] Consentimento, retenção e governança para uso multiusuário.

## Critérios para considerar produção pronta

- [ ] Credenciais Pluggy de produção ativas.
- [ ] RLS validado em todas as tabelas.
- [ ] Backup automático e restauração testada.
- [ ] Monitoramento mínimo configurado.
- [ ] Testes e build aprovados.
- [ ] Sincronização real conferida contra os bancos.
- [ ] Runbook de incidente revisado.
- [ ] Segredos rotacionados e separados por ambiente.
