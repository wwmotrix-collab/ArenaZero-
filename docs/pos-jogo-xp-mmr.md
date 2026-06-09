# Pós-jogo Arena Zerø — XP, MMR e Ranking

Este documento consolida as regras usadas pelo fluxo de pós-jogo da Arena Zerø.

## Objetivo

Depois da partida, a arena registra o placar, escolhe opcionalmente o melhor jogador e o sistema atualiza XP, MMR, ranking geral e ranking por esporte.

## Fluxo

1. Arena abre a partida no painel.
2. Clica em Resultado.
3. Informa placar do Time 1 e Time 2.
4. Seleciona melhor jogador, se houver.
5. Sistema valida jogadores mínimos.
6. Sistema calcula XP e MMR.
7. Sistema salva snapshot na partida.
8. Sistema atualiza jogadores e ranking.
9. Partida recebe status `finalizada`.

## XP visível

XP é a moeda de engajamento visível para o jogador.

| Resultado | XP base |
|---|---:|
| Vitória | 10 |
| Empate | 8 |
| Derrota | 6 |

Bônus padrão:

| Bônus | Valor |
|---|---:|
| Capitão | +2 |
| Melhor jogador | `Math.round(4 + Math.log1p(bestPlayerCountAnterior) * 2)` |

## MMR oculto

MMR mede força competitiva e usa lógica de Elo.

```txt
esperado = 1 / (1 + 10 ^ ((MMR médio adversário - MMR médio do time) / 400))
novo MMR = MMR atual + 32 * (resultado - esperado)
```

Resultado numérico:

| Resultado | Valor |
|---|---:|
| Vitória | 1 |
| Empate | 0.5 |
| Derrota | 0 |

## Anti-abuso

O sistema reduz XP quando detecta repetição forte de grupo na mesma data e esporte.

| Situação | Fator XP |
|---|---:|
| Sem repetição relevante | 1.0 |
| Uma repetição relevante | 0.5 |
| Duas ou mais repetições relevantes | 0.2 |

A repetição relevante considera sobreposição de 70% ou mais dos jogadores.

## Estrutura recomendada de resultado

```js
result: {
  team1Score: 3,
  team2Score: 2,
  winner: 'team1',
  bestPlayerId: 'player-id',
  antiAbuseFactor: 1,
  xpRulesVersion: 'arena-zero-postgame-1.0.0',
  mmrRulesVersion: 'arena-zero-postgame-1.0.0',
  submittedAt: 'ISO_DATE',
  xpApplied: true
}
```

## Arquivos relacionados

- `js/app.js`: fluxo atual de UI, resultado e ranking.
- `js/postgame-engine.js`: funções puras de cálculo XP/MMR.
- `tools/picoclaw/prompts/pos-jogo-arena-zero.md`: prompt operacional do PicoClaw.
- `tools/picoclaw/config/postgame-agent.json`: configuração do agente.
