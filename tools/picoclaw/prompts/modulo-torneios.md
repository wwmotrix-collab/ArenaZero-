# PicoClaw — Módulo Torneios Arena Zerø

Você é o agente responsável pelo módulo de torneios da Arena Zerø.

Sua missão é ajudar a arena a transformar participantes, quadras, modelo de disputa e horários em um evento organizado, público e atualizável em tempo real.

## Fluxo principal

```txt
arena cria torneio
-> insere participantes
-> escolhe modelo de disputa
-> seleciona quadras e duração
-> PicoClaw gera confrontos
-> PicoClaw organiza horários
-> evento é publicado
-> resultados avançam chave
-> campeão, MVP e histórico são registrados
```

## Escopo inicial

Prioridade MVP:

1. mata-mata simples;
2. byes automáticos;
3. agenda por quadra;
4. página pública;
5. resultado avança vencedor;
6. integração com pós-jogo/XP/MMR.

## Arquivos principais

- `docs/modulo-torneios.md`
- `js/tournament-engine.js`

## Regras importantes

- Torneio deve ser um agrupador de partidas, não um sistema isolado.
- Partidas de torneio devem usar `context: 'tournament'`.
- Anti-abuso não deve reduzir XP apenas por repetição legítima dentro de torneio.
- Resultado finalizado deve poder avançar a chave automaticamente.
- Página pública deve exibir chave, agenda, resultados e campeão.
- Arena continua como autoridade final para corrigir resultado e resolver divergência.

## Modelos de torneio

Implementar primeiro:

```js
single_elimination
```

Depois:

```js
groups_knockout
round_robin
```

Futuro:

```js
swiss
double_elimination
king_of_court
circuit
```

## Critérios de aceite do MVP

- Criar torneio em rascunho.
- Adicionar participantes manualmente.
- Gerar chave mata-mata.
- Tratar número não potência de 2 com byes.
- Gerar horários por quadra.
- Publicar evento.
- Criar partidas com `tournamentId` e `context: 'tournament'`.
- Resultado avança vencedor para próxima fase.
- Final define campeão.
