# Arena Zero — estrutura baseada no Pindura

Esta versão remove o modo demo como fluxo principal e adapta o padrão do Pindura:

Comerciante -> Arena
Cliente -> Capitão/Player
Lançar compra -> Criar partida/reserva
Confirmação por WhatsApp -> Convocação da partida
Caderneta -> Lobby/escalação

## Fluxo implementado

1. Login/criação da Arena.
2. Configuração de quadras.
3. Configuração de esportes com cálculo de players por time, times, reservas e duração.
4. Criação de partida/reserva paga com data, horário, quadra, esporte e capitão.
5. Geração de texto/link WhatsApp para o capitão.
6. Convite abre pelo token `?match=TOKEN`.
7. Player/capitão confirma nome + WhatsApp.
8. Confirmação salva em `participations` no Firestore.
9. Lobby atualiza contador, vagas titulares e reservas.

## Deploy

```bash
firebase use arenazero-2a0fd
firebase deploy --only firestore,hosting
```

## Coleções Firestore

- `arenas`
- `courts`
- `sports`
- `matches`
- `participations`
- `players` e `rankings` reservadas para XP/MMR.
