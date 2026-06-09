export const RESERVATION_STATUS = Object.freeze({
  AVAILABLE: 'available',
  HELD: 'held',
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  BLOCKED: 'blocked',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
});

export const DEFAULT_HOLD_MINUTES = 10;

export function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function timeToMinutes(time = '00:00') {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

export function dateKey(date) {
  if (date instanceof Date) return date.toISOString().slice(0, 10);
  return String(date || '').slice(0, 10);
}

export function weekdayKey(date) {
  const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const value = date instanceof Date ? date : new Date(`${dateKey(date)}T12:00:00`);
  return keys[value.getDay()];
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function buildDaySlots({ arena = {}, sport = {}, date, reservations = [], blocks = [], now = new Date() }) {
  const day = dateKey(date);
  const weekday = weekdayKey(day);
  const intervals = arena.openingHours?.[weekday] || [];
  const courts = (arena.courts || []).filter((court) => court.active !== false);
  const slotInterval = Number(arena.slotIntervalMinutes || 30);
  const duration = Number(sport.duration || arena.defaultMatchDurationMinutes || 60);
  const minAdvance = Number(arena.minAdvanceMinutes || 0);
  const slots = [];

  for (const court of courts) {
    if (court.sportIds?.length && !court.sportIds.includes(sport.id)) continue;
    for (const interval of intervals) {
      const startLimit = timeToMinutes(interval.start);
      const endLimit = timeToMinutes(interval.end);
      for (let start = startLimit; start + duration <= endLimit; start += slotInterval) {
        const end = start + duration;
        const startTime = minutesToTime(start);
        const endTime = minutesToTime(end);
        const startsAt = new Date(`${day}T${startTime}:00`);
        const tooSoon = startsAt.getTime() < new Date(now).getTime() + minAdvance * 60_000;
        const conflictingReservation = reservations.find((reservation) => reservation.date === day && reservation.courtId === court.id && ['held', 'pending_payment', 'confirmed'].includes(reservation.status) && overlaps(start, end, timeToMinutes(reservation.startTime), timeToMinutes(reservation.endTime)));
        const conflictingBlock = blocks.find((block) => block.date === day && (!block.courtId || block.courtId === court.id) && overlaps(start, end, timeToMinutes(block.startTime), timeToMinutes(block.endTime)));
        const status = tooSoon || conflictingBlock ? RESERVATION_STATUS.BLOCKED : conflictingReservation ? conflictingReservation.status : RESERVATION_STATUS.AVAILABLE;
        slots.push({
          arenaId: arena.id,
          sportId: sport.id,
          courtId: court.id,
          courtName: court.name,
          date: day,
          startTime,
          endTime,
          startsAt: startsAt.toISOString(),
          durationMinutes: duration,
          status,
          reservationId: conflictingReservation?.id || null,
          blockId: conflictingBlock?.id || null,
        });
      }
    }
  }
  return slots;
}

export function groupSlotsByPeriod(slots = []) {
  return {
    morning: slots.filter((slot) => timeToMinutes(slot.startTime) < 12 * 60),
    afternoon: slots.filter((slot) => timeToMinutes(slot.startTime) >= 12 * 60 && timeToMinutes(slot.startTime) < 17 * 60),
    night: slots.filter((slot) => timeToMinutes(slot.startTime) >= 17 * 60),
  };
}

export function createHoldReservation({ slot, customer = {}, holdMinutes = DEFAULT_HOLD_MINUTES, source = 'public_arena_page', utm = {} }) {
  const now = new Date();
  return {
    arenaId: slot.arenaId,
    sportId: slot.sportId,
    courtId: slot.courtId,
    courtName: slot.courtName,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: RESERVATION_STATUS.HELD,
    customerName: customer.name || '',
    customerPhone: customer.phone || '',
    customerEmail: customer.email || '',
    paymentStatus: 'not_required',
    holdExpiresAt: new Date(now.getTime() + Number(holdMinutes || DEFAULT_HOLD_MINUTES) * 60_000).toISOString(),
    matchId: null,
    source,
    utm,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function isHoldExpired(reservation, now = new Date()) {
  return reservation?.status === RESERVATION_STATUS.HELD && reservation.holdExpiresAt && new Date(reservation.holdExpiresAt).getTime() <= new Date(now).getTime();
}

export function expireHold(reservation, now = new Date()) {
  if (!isHoldExpired(reservation, now)) return reservation;
  return { ...reservation, status: RESERVATION_STATUS.EXPIRED, updatedAt: new Date(now).toISOString() };
}

export function confirmReservation(reservation, patch = {}) {
  return {
    ...reservation,
    ...patch,
    status: RESERVATION_STATUS.CONFIRMED,
    paymentStatus: patch.paymentStatus || reservation.paymentStatus || 'not_required',
    confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function reservationToMatch(reservation, arena, sport, court, captainPlayer) {
  return {
    reservationId: reservation.id || null,
    source: 'reservation_automation',
    arenaId: reservation.arenaId,
    arena,
    sportId: reservation.sportId,
    sport,
    courtId: reservation.courtId,
    court,
    date: reservation.date,
    time: reservation.startTime,
    captainName: reservation.customerName,
    captainPhone: reservation.customerPhone,
    required: reservation.required || 0,
    status: 'aberta',
    players: captainPlayer ? [captainPlayer] : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
