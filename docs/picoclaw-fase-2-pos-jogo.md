# PicoClaw — Fase 2 do Pós-Jogo

## Decisão

A Fase 2 do pós-jogo deve ser responsabilidade operacional do PicoClaw.

Nesta etapa, o PicoClaw deixa de atuar apenas como referência de regra e passa a trabalhar como orquestrador do fluxo pós-jogo: detectar partidas vencidas, criar pendências, atualizar status e preparar a coleta de resultado no perfil do player.

---

## Papel do PicoClaw na Fase 2

O PicoClaw deve operar o ciclo:

```txt
partida em andamento -> fim estimado vencido -> XP pendente -> coleta de resultado -> consenso ou validação da arena
```

Ele NÃO deve aplicar XP/MMR sozinho antes do resultado ser finalizado.

Ele deve preparar a coleta e manter o estado da partida organizado.

---

## Gatilho temporal

A referência é:

```txt
triggerAt = match.date + match.time + sport.duration + toleranceMinutes
```

Recomendação inicial:

```txt
toleranceMinutes = 10
```

Exemplo:

```txt
20:00 início
60 min duração
21:00 fim estimado
21:10 PicoClaw abre pós-jogo
```

---

## Rotina da Fase 2

O PicoClaw deve executar, ou gerar implementação para executar, uma rotina periódica:

```txt
A cada 5 ou 10 minutos:
1. buscar partidas com status em_andamento ou aberta formada;
2. calcular fim estimado;
3. verificar se agora >= fim estimado + tolerância;
4. mudar status para aguardando_resultado;
5. criar postgameTasks para jogadores titulares;
6. marcar XP como pendente/trancado;
7. preparar card no perfil do player;
8. disparar push/notificação quando houver suporte.
```

---

## Coleção postgameTasks

Coleção sugerida:

```txt
postgameTasks
```

Documento sugerido:

```js
{
  matchId,
  arenaId,
  sportId,
  playerId,
  playerName,
  playerPhone,
  status: 'pending',
  triggerAt,
  openedAt,
  answeredAt: null,
  answer: null,
  xpLocked: true,
  createdBy: 'picoclaw-postgame-orchestrator',
  createdAt,
  updatedAt
}
```

---

## Mensagem para o player

A comunicação deve ser menos burocrática e mais ligada à recompensa.

Boas opções:

```txt
XP pendente no lobby. Confirme o resultado da partida.
```

```txt
Sua partida terminou? Confirme o placar para liberar seu XP.
```

```txt
Resultado em aberto. Confirme o placar e atualize seu ranking.
```

---

## Limites do PicoClaw

O PicoClaw pode:

- detectar partida vencida por tempo;
- alterar status para `aguardando_resultado`;
- criar pendências de resultado;
- preparar card de XP pendente no perfil do player;
- registrar respostas de jogadores;
- calcular consenso social;
- sinalizar divergência para arena.

O PicoClaw não deve:

- aplicar XP/MMR antes de resultado confirmado;
- finalizar partida contestada sem regra clara;
- sobrescrever resultado manual da arena;
- punir player por não responder na primeira versão.

---

## Estados recomendados

```js
'aberta'
'em_andamento'
'aguardando_resultado'
'aguardando_confirmacao_resultado'
'finalizada'
'contestada'
'cancelada'
```

---

## Critérios de aceite

A Fase 2 estará pronta quando:

- partidas vencidas por tempo forem detectadas automaticamente;
- `postgameTasks` forem criadas para titulares;
- o perfil do player mostrar `XP pendente`;
- o player puder enviar placar sugerido;
- respostas iguais avançarem para consenso;
- respostas divergentes enviarem a partida para `contestada` ou validação da arena;
- XP/MMR continuarem bloqueados até a finalização real do resultado.

---

## Implementação sugerida

Primeira versão sem Cloud Function:

- implementar cálculo local quando o player abrir perfil/link;
- se a partida estiver vencida, mostrar card `XP pendente`;
- salvar resposta em `postgameTasks`.

Segunda versão com backend:

- Firebase scheduled function ou rotina equivalente;
- varredura a cada 5 ou 10 minutos;
- criação automática das tasks;
- push real via FCM quando houver token.
