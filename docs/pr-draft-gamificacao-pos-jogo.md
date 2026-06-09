# PR Draft — Camada de Gamificação Pós-Jogo

## Objetivo

Adicionar uma camada de gamificação sobre o pós-jogo da Arena Zerø, conectando resultado, XP, MMR, melhor jogador, perfil do player e feedback visual imediato.

Esta PR começa como especificação técnica para evoluir em pequenos patches seguros.

---

## Diagnóstico do estado atual

Hoje a coleta de resultado é disparada manualmente pela arena:

1. A arena acessa o dashboard.
2. Cada card de partida possui o botão `Resultado`.
3. O clique chama `openResult(matchId)`.
4. A tela de resultado permite inserir placar e escolher melhor jogador.
5. O botão de salvar chama `saveResult()`.
6. `saveResult()` valida se a partida ainda não está finalizada, calcula XP/MMR, atualiza jogadores e marca a partida como `finalizada`.

Ponto importante: hoje não existe disparo automático por horário de fim de jogo. O gatilho é operacional/manual.

---

## Decisão atualizada de produto

O gatilho principal do pós-jogo deve ser automático, baseado no tempo configurado da partida.

Quando a partida atingir o tempo estimado de encerramento, o sistema envia uma notificação/push para o perfil dos players participantes solicitando a coleta do resultado. A chamada pode ser menos direta e mais gamificada, por exemplo:

> Sua partida terminou? Confirme o placar para liberar seu XP.

O objetivo é transformar a coleta de resultado em parte natural da recompensa, não em uma obrigação burocrática.

---

## Gatilho automático recomendado

### Fórmula base

```txt
fim_estimado = match.date + match.time + sport.duration
abertura_pos_jogo = fim_estimado + tolerancia
```

### Tolerância inicial

Recomendação: `10 minutos` após o fim estimado.

Motivo:

- evita pedir resultado enquanto a partida ainda está terminando;
- considera atraso leve, troca de quadra e conversa pós-jogo;
- ainda mantém o registro quente na memória dos jogadores.

### Exemplo

Partida às 20:00, duração configurada de 60 min:

```txt
20:00 início
21:00 fim estimado
21:10 push de pós-jogo
```

---

## Gatilhos de pós-jogo propostos

### Gatilho 1 — Push no perfil do player

Gatilho principal.

Condição:

```txt
agora >= match.date + match.time + sport.duration + tolerancia
```

E:

```txt
match.status !== 'finalizada'
```

Ação:

- criar pendência de resultado para cada player titular;
- exibir card no perfil do player;
- enviar push/notificação quando houver suporte;
- liberar fluxo de confirmação de placar.

Texto sugerido:

```txt
Partida finalizada. Confirme o placar para receber XP.
```

Versão mais gameficada:

```txt
XP pendente no lobby. Confirme o resultado da partida.
```

### Gatilho 2 — Card flutuante no perfil

Ao abrir o perfil do jogador, se houver partida pendente:

- mostrar `XP pendente`;
- mostrar partida, arena e horário;
- botão `Confirmar resultado`;
- botão secundário `Não joguei / reportar problema`.

### Gatilho 3 — Consenso social

Resultado pode ser aceito automaticamente quando houver consenso mínimo.

Proposta inicial:

- capitão confirma; ou
- 2 jogadores do mesmo time + 1 jogador do outro time confirmam; ou
- maioria simples dos titulares confirma o mesmo placar.

Enquanto não houver consenso, a partida fica como:

```txt
aguardando_confirmacao_resultado
```

### Gatilho 4 — Arena como autoridade final

A arena mantém o botão manual `Resultado` como fallback e validação final.

Uso:

- corrigir placar divergente;
- encerrar partida sem consenso;
- resolver denúncia;
- lançar resultado quando players não responderem.

---

## Status sugeridos para partida

```js
'aberta'
'em_andamento'
'aguardando_resultado'
'aguardando_confirmacao_resultado'
'finalizada'
'contestada'
'cancelada'
```

### Transição recomendada

```txt
aberta -> em_andamento -> aguardando_resultado -> aguardando_confirmacao_resultado -> finalizada
```

A arena pode pular direto para `finalizada` via painel manual.

---

## Estrutura sugerida para pendências de resultado

Pode ser uma subcoleção ou coleção desacoplada.

### Opção recomendada

Coleção:

```txt
postgameTasks
```

Documento:

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
  createdAt,
  updatedAt
}
```

Resposta do player:

```js
answer: {
  team1Score: 3,
  team2Score: 2,
  bestPlayerId: 'player-id',
  played: true,
  note: ''
}
```

---

## Regra de XP pendente

O XP só deve ser liberado quando o resultado for finalizado.

Antes disso, o perfil pode mostrar:

```txt
XP pendente: confirme o placar para liberar recompensa.
```

Importante: não é necessário punir imediatamente quem não responde. Melhor usar incentivo:

- confirmar resultado conta para badge de presença;
- confirmar rápido pode contar para streak de colaboração;
- players recorrentes com baixa resposta podem perder prioridade em convites futuros, mas isso fica para fase futura.

---

## Sugestão de UX

### No perfil do player

Card flutuante:

```txt
XP pendente
Arena Zerø detectou que sua partida terminou.
Confirme o placar para liberar XP e atualizar ranking.

[Confirmar resultado]
[Reportar problema]
```

### Após confirmação

```txt
Resultado enviado.
Aguardando confirmação do lobby.
```

### Após finalização

```txt
+10 XP — vitória registrada
Ranking atualizado
```

---

## Regras de XP propostas

Base simplificada:

| Resultado | XP |
|---|---:|
| Vitória | 10 |
| Empate | 8 |
| Derrota | 6 |

Bônus:

| Evento | XP |
|---|---:|
| Capitão | +2 |
| Melhor jogador | fórmula logarítmica |
| Confirmação de resultado | +1 futuro |
| Sequência de vitórias | futuro |
| Fair play / presença confirmada | futuro |

Fórmula do melhor jogador:

```js
bonusBestPlayer = Math.round(4 + Math.log1p(previousBestPlayerCount) * 2)
```

Exemplos aproximados:

| Destaques anteriores | Bônus |
|---:|---:|
| 0 | +4 XP |
| 1 | +5 XP |
| 3 | +7 XP |
| 10 | +9 XP |

A ideia é premiar, mas sem deixar o ranking virar apenas disputa de MVP.

---

## MMR do melhor jogador

Proposta: melhor jogador NÃO deve ganhar MMR extra diretamente.

Motivo: MMR mede força competitiva do resultado contra adversários. Se o melhor jogador ganhar MMR extra, o sistema mistura performance subjetiva com força estatística.

Alternativa recomendada:

- melhor jogador ganha XP visível;
- recebe badge/conquista;
- entra em métricas de reputação;
- MMR muda apenas por resultado e força relativa dos times.

Exceção futura: criar um índice separado, por exemplo `impactScore`, para destaque técnico.

---

## Layer flutuante de evolução do player

Adicionar uma camada visual flutuante após atualização de XP/MMR.

### Nome de trabalho

`PlayerEvolutionLayer`

### Quando aparece

- quando existir XP pendente;
- após confirmar presença;
- após confirmar resultado;
- após resultado lançado;
- ao abrir perfil do jogador depois de mudança recente;
- ao subir de nível;
- ao ganhar badge;
- ao ser eleito melhor jogador.

### Conteúdo

Card flutuante com:

- avatar/iniciais;
- XP pendente ou XP ganho;
- barra de progresso até próximo nível;
- badge nova, se houver;
- variação de MMR para admin/arena;
- mensagem dinâmica conforme comportamento.

Exemplos de mensagens:

- `XP pendente — confirme o placar`
- `+10 XP — vitória registrada`
- `+4 XP bônus — melhor jogador`
- `Sequência ativa: 3 vitórias`
- `MMR +12 — venceu time mais forte`
- `Ranking atualizado`

---

## Evolução por níveis

Proposta inicial:

| Nível | XP acumulado | Título |
|---:|---:|---|
| 1 | 0 | Recruta |
| 2 | 50 | Presença Confirmada |
| 3 | 120 | Player de Lobby |
| 4 | 250 | Titular |
| 5 | 500 | Destaque da Arena |
| 6 | 900 | Lenda Local |

Função sugerida:

```js
function levelFromXp(xp) {
  if (xp >= 900) return { level: 6, title: 'Lenda Local' };
  if (xp >= 500) return { level: 5, title: 'Destaque da Arena' };
  if (xp >= 250) return { level: 4, title: 'Titular' };
  if (xp >= 120) return { level: 3, title: 'Player de Lobby' };
  if (xp >= 50) return { level: 2, title: 'Presença Confirmada' };
  return { level: 1, title: 'Recruta' };
}
```

---

## Novas estruturas sugeridas no player

```js
{
  xp: 132,
  mmr: 1018,
  level: 3,
  levelTitle: 'Player de Lobby',
  badges: ['primeira-vitoria', 'mvp-da-partida'],
  pendingPostgameTasks: 1,
  streaks: {
    wins: 2,
    attendance: 5,
    resultConfirmations: 4
  },
  lastEvolution: {
    matchId,
    xpEarned,
    mmrDelta,
    levelBefore,
    levelAfter,
    badgesUnlocked,
    createdAt
  }
}
```

---

## Badges iniciais

- `primeira-partida`
- `primeira-vitoria`
- `primeiro-mvp`
- `capitao-do-lobby`
- `sequencia-3-vitorias`
- `presenca-5-partidas`
- `colaborador-pos-jogo`
- `zebra-da-rodada` — venceu time com MMR médio maior

---

## Sugestão técnica de implementação

### Fase 1 — Sem push real ainda

Implementar como card dentro do perfil/player quando ele abre o app ou link:

- calcular pendências vencidas no client;
- buscar partidas do player com status `em_andamento` ou `aguardando_resultado`;
- se passou do fim estimado + tolerância, mostrar card `XP pendente`.

### Fase 2 — Cloud Function agendada

Depois, mover para backend:

- função roda a cada 5 ou 10 minutos;
- encontra partidas com fim estimado vencido;
- cria `postgameTasks`;
- muda status para `aguardando_resultado`;
- dispara notificação/push se houver token.

### Fase 3 — Push real

Adicionar tokens por jogador:

```js
players/{id}.pushTokens[]
```

E enviar via Firebase Cloud Messaging.

---

## Critérios de aceite da PR futura

- O fluxo manual da arena continua funcionando.
- Partida finalizada não reaplica XP/MMR.
- Ao passar duração + tolerância, o player vê card de `XP pendente`.
- Player consegue enviar placar sugerido.
- Resultado só finaliza com consenso ou validação da arena.
- Melhor jogador ganha XP bônus, badge e snapshot.
- MMR continua baseado em resultado, não em MVP subjetivo.
- Jogador recebe `level`, `levelTitle`, `badges`, `pendingPostgameTasks` e `lastEvolution`.
- Existe camada visual flutuante reaproveitável.
- Ranking pode exibir nível e badges sem poluir.

---

## Arquivos prováveis da implementação

- `js/postgame-engine.js`
- `js/gamification-engine.js`
- `js/player-evolution-layer.js`
- `js/postgame-tasks.js`
- `js/app.js`
- `css/overrides.css`
- `docs/pos-jogo-xp-mmr.md`
