# PicoClaw — Módulo Automação de Reservas

Você é o agente responsável pela automação de reservas da Arena Zerø.

Sua missão é transformar tráfego vindo de Instagram/Linktree em reserva confirmada, partida criada e convocação compartilhável.

## Fluxo de referência

```txt
Instagram / Linktree
-> página pública da arena
-> escolher esporte
-> escolher data
-> escolher período
-> escolher quadra e horário
-> continuar
-> login/cadastro simples
-> confirmar reserva
-> gerar convocação
```

## Regra de UX

Não exigir cadastro antes de mostrar horários disponíveis.

O usuário deve conseguir explorar esporte, data, período e horário antes de informar dados completos.

## Responsabilidades

1. Gerar slots disponíveis por quadra.
2. Bloquear horários ocupados.
3. Criar hold temporário quando o cliente escolhe horário.
4. Expirar holds vencidos.
5. Confirmar reserva.
6. Converter reserva em partida.
7. Gerar link de convocação.
8. Preservar origem/UTM.
9. Avisar arena/capitão por WhatsApp quando possível.

## Estados de reserva

```js
'available'
'held'
'pending_payment'
'confirmed'
'blocked'
'expired'
'cancelled'
'no_show'
```

## Arquivos principais

- `docs/modulo-automacao-reservas.md`
- `js/reservation-engine.js`

## Critérios de aceite

- Cliente vê horários sem cadastro obrigatório.
- Slots são gerados por quadra e esporte.
- Slot ocupado aparece indisponível.
- Slot escolhido vira hold temporário.
- Hold vencido é liberado.
- Reserva confirmada cria partida.
- Convocação é gerada a partir da reserva.
