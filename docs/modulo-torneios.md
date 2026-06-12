# Módulo Torneios — Arena Zerø

## Objetivo

Criar um módulo para arenas organizarem torneios completos dentro da Arena Zerø.

A arena informa participantes, quadras, esporte, modelo de disputa e regras de avanço. O sistema gera confrontos, chaves, agenda de jogos, página pública e integração com resultados, XP/MMR e avanço automático.

---

## Visão do fluxo

```txt
arena cria torneio
-> define esporte, quadras e duração dos jogos
-> escolhe modelo de disputa
-> insere participantes/times
-> sistema gera confrontos e horários
-> torneio vira público
-> resultados alimentam avanço de fase
-> campeão, MVP, XP, badges e histórico são registrados
```

---

## Perfis

### Arena/Admin

Pode:

- criar torneio;
- editar participantes;
- escolher modelo;
- gerar chaveamento;
- ajustar horários/quadras;
- publicar evento;
- lançar/validar resultados;
- avançar fases;
- finalizar torneio.

### Player/Público

Pode:

- acessar link público do torneio;
- ver participantes;
- ver chaveamento;
- ver agenda;
- ver resultados;
- acompanhar classificação;
- receber convocação de próxima partida.

---

## Status do torneio

```js
'rascunho'
'publicado'
'em_andamento'
'finalizado'
'cancelado'
```

---

## Modelos de disputa iniciais

### 1. Mata-mata simples

Primeiro MVP.

- gera rodada inicial;
- aceita byes quando número de participantes não for potência de 2;
- vencedor avança;
- final define campeão.

### 2. Fase de grupos + mata-mata

Segundo passo.

- divide participantes em grupos;
- todos contra todos dentro do grupo;
- classificados avançam para mata-mata.

### 3. Pontos corridos

Terceiro passo.

- todos contra todos;
- ranking por pontos;
- critérios de desempate configuráveis.

---

## Modelos futuros

- Suíço;
- dupla eliminação;
- rei da quadra;
- ranking por tempo de arena;
- circuito com várias etapas.

---

## Dados informados pela arena

```js
{
  name: 'Torneio de Futebol 7 - Sábado',
  arenaId,
  sportId,
  model: 'single_elimination',
  status: 'rascunho',
  public: false,
  startsAt: '2026-06-20T14:00:00',
  courts: ['quadra-a', 'quadra-b'],
  matchDurationMinutes: 20,
  breakDurationMinutes: 5,
  participants: [],
  seedingMode: 'random',
  createdAt,
  updatedAt
}
```

---

## Participantes

Um participante pode representar:

- player individual;
- dupla;
- time;
- equipe avulsa cadastrada pela arena.

Estrutura:

```js
{
  id,
  name,
  type: 'team',
  playerIds: [],
  seed: 1,
  phone,
  status: 'confirmed'
}
```

---

## Estrutura de torneio

Coleção sugerida:

```txt
tournaments
```

Documento:

```js
{
  id,
  arenaId,
  name,
  sportId,
  sport,
  model,
  status,
  public,
  publicToken,
  startsAt,
  courts,
  matchDurationMinutes,
  breakDurationMinutes,
  participants,
  bracket,
  standings,
  championParticipantId,
  mvpPlayerId,
  createdAt,
  updatedAt
}
```

---

## Partidas do torneio

As partidas do torneio podem reaproveitar a coleção `matches`.

Campos adicionais:

```js
{
  tournamentId,
  tournamentRound,
  tournamentMatchNumber,
  bracketPosition,
  context: 'tournament',
  team1ParticipantId,
  team2ParticipantId,
  winnerParticipantId,
  loserParticipantId,
  winnerAdvancesTo,
  loserGoesTo,
  scheduledCourtId,
  scheduledAt
}
```

---

## Regra anti-abuso

Partidas de torneio devem ter tratamento especial.

```js
match.context === 'tournament'
```

Quando isso existir:

- não reduzir XP apenas por repetição de jogadores no mesmo dia;
- permitir múltiplas partidas legítimas;
- ainda manter validação contra partidas falsas, WO e manipulação.

---

## Página pública

Cada torneio deve gerar link público:

```txt
/torneio/{publicToken}
```

Conteúdo:

- nome do torneio;
- arena;
- esporte;
- inscritos;
- chaves;
- agenda;
- quadras;
- resultados;
- classificação;
- próxima partida;
- campeão;
- MVP do torneio.

---

## Integração com pós-jogo

O módulo de torneios conversa com a Fase 2 de pós-jogo.

Quando `match.tournamentId` existir:

```txt
resultado finalizado
-> XP/MMR aplicado
-> vencedor definido
-> chave avança automaticamente
-> próxima partida é liberada/agendada
-> página pública atualiza
```

---

## MVP sugerido

Primeira entrega deve conter:

1. cadastro de torneio;
2. participantes manuais;
3. mata-mata simples;
4. geração automática de byes;
5. geração de partidas e agenda por quadra;
6. página pública básica;
7. aplicação manual de resultado pela arena;
8. avanço automático de vencedor;
9. integração futura com Fase 2 de pós-jogo.

---

## Critérios de aceite

- Arena cria torneio em rascunho.
- Arena adiciona participantes.
- Sistema gera chave mata-mata simples.
- Sistema cria agenda usando quadras, duração e intervalo.
- Byes são tratados automaticamente.
- Torneio pode ser publicado.
- Link público exibe chave e jogos.
- Resultado de uma partida atualiza o avanço de fase.
- Partidas de torneio são marcadas com `context: 'tournament'`.
- Anti-abuso reconhece torneio como exceção para repetição legítima.
