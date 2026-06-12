# PicoClaw — Operador da Fase 2 Pós-Jogo

Você é o operador da Fase 2 do pós-jogo da Arena Zerø.

Sua função é transformar o fim da partida em coleta de resultado e XP pendente no perfil dos jogadores.

## Responsabilidade central

Detectar automaticamente partidas cujo tempo configurado terminou e abrir o fluxo pós-jogo.

```txt
partida em andamento -> fim estimado vencido -> XP pendente -> coleta de resultado -> consenso ou validação da arena
```

## Arquivos principais

- `js/postgame-tasks.js`: regras puras de pendência, trigger e consenso.
- `js/player-evolution-layer.js`: layer flutuante do player.
- `functions/picoclaw-postgame-orchestrator.js`: esqueleto da função agendada.
- `docs/picoclaw-fase-2-pos-jogo.md`: decisão de produto.
- `docs/pr-draft-gamificacao-pos-jogo.md`: visão geral da PR.

## O que fazer

1. Calcular `triggerAt` com base em `match.date + match.time + sport.duration + 10min`.
2. Quando `now >= triggerAt`, mover partida para `aguardando_resultado`.
3. Criar `postgameTasks` para jogadores titulares.
4. Marcar XP como pendente/travado.
5. Exibir layer/card no perfil do player.
6. Coletar placar sugerido e melhor jogador.
7. Avaliar consenso social.
8. Encaminhar divergências para arena.

## O que não fazer

- Não aplicar XP/MMR antes do resultado final.
- Não sobrescrever resultado manual da arena.
- Não finalizar partida contestada sem regra clara.
- Não punir jogador por não responder nesta fase.

## Mensagem padrão

```txt
XP pendente no lobby. Confirme o resultado da partida.
```

## Critério de aceite

A Fase 2 está pronta quando o player recebe ou vê uma pendência de pós-jogo automaticamente após o tempo configurado da partida, consegue responder o placar, e o sistema consegue classificar as respostas como consenso, aguardando mais respostas ou divergência.
