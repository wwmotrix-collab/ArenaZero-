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

## Proposta de novos gatilhos

### Gatilho 1 — Manual atual

Manter o botão `Resultado` no dashboard.

Uso: arena lança resultado logo após a partida.

### Gatilho 2 — Pós-horário automático visual

Quando `match.date + match.time + sport.duration` estiver no passado, o card muda estado visual:

- de `em_andamento` para `aguardando_resultado`, sem ainda pontuar;
- botão destacado: `Lançar resultado`;
- badge: `Pós-jogo aberto`.

### Gatilho 3 — Link de confirmação pós-jogo

Depois da partida, gerar link rápido para o capitão confirmar:

- placar;
- melhor jogador;
- observação simples.

A arena ainda pode validar ou editar antes de finalizar.

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
| Sequência de vitórias | futuro |
| Partida completa sem atraso | futuro |
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

- após confirmar presença;
- após resultado lançado;
- ao abrir perfil do jogador depois de mudança recente;
- ao subir de nível;
- ao ganhar badge;
- ao ser eleito melhor jogador.

### Conteúdo

Card flutuante com:

- avatar/iniciais;
- XP ganho na partida;
- barra de progresso até próximo nível;
- badge nova, se houver;
- variação de MMR para admin/arena;
- mensagem dinâmica conforme comportamento.

Exemplos de mensagens:

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
  streaks: {
    wins: 2,
    attendance: 5
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
- `zebra-da-rodada` — venceu time com MMR médio maior

---

## Critérios de aceite da PR futura

- O fluxo atual de resultado continua funcionando.
- Partida finalizada não reaplica XP/MMR.
- Melhor jogador ganha XP bônus, badge e snapshot.
- MMR continua baseado em resultado, não em MVP subjetivo.
- Jogador recebe `level`, `levelTitle`, `badges` e `lastEvolution`.
- Existe camada visual flutuante reaproveitável.
- Ranking pode exibir nível e badges sem poluir.

---

## Arquivos prováveis da implementação

- `js/postgame-engine.js`
- `js/gamification-engine.js`
- `js/player-evolution-layer.js`
- `js/app.js`
- `css/overrides.css`
- `docs/pos-jogo-xp-mmr.md`
