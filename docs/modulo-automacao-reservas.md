# Módulo Automação de Reservas — Arena Zerø

## Referência analisada

Fluxo observado no webarena.app / Beach Place POA a partir dos prints enviados:

```txt
Instagram / Linktree
-> Reserve sua quadra
-> página pública da arena
-> descrição / informações / cancelamento
-> escolha do esporte
-> escolha da data no calendário
-> escolha do período: manhã, tarde ou noite
-> escolha da quadra e horário disponível
-> continuar
-> login ou cadastro do cliente
```

O ponto mais importante: o cadastro aparece depois da intenção de reserva, não antes da exploração da agenda.

Para Arena Zerø, o fluxo recomendado é manter baixa fricção:

```txt
ver arena
-> escolher esporte
-> escolher data
-> escolher horário
-> segurar slot
-> pedir WhatsApp/nome
-> confirmar ou pagar sinal
-> gerar reserva + convocação
```

---

## Objetivo

Criar um módulo para automatizar reservas de quadras, conectando página pública da arena, disponibilidade em tempo real, trava temporária de horário, confirmação por WhatsApp/pagamento e criação automática da partida/convocação.

---

## Princípio de UX

Não bloquear a escolha do horário com cadastro obrigatório.

Cadastro completo pode existir, mas deve aparecer somente após seleção do horário, no momento de confirmar reserva, ou como login opcional para cliente recorrente.

Campos mínimos para primeira reserva:

```txt
nome
WhatsApp
```

---

## MVP sugerido

1. página pública da arena;
2. seleção de esporte;
3. calendário;
4. períodos manhã/tarde/noite;
5. slots por quadra;
6. hold temporário;
7. nome + WhatsApp;
8. confirmar reserva sem pagamento;
9. criar match automaticamente;
10. gerar link de convocação.

---

## Critérios de aceite

- Cliente consegue ver horários sem cadastro obrigatório.
- Arena configura quadras, esportes e horários.
- Sistema gera slots disponíveis.
- Horários ocupados aparecem indisponíveis.
- Cliente consegue segurar um slot.
- Hold expira e libera horário.
- Reserva confirmada cria partida.
- Link de convocação é gerado.
- UTM/source do Instagram/Linktree é preservado.
