import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function normalizeBrazilPhone(value = '') {
  let d = onlyDigits(value);

  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('55')) d = d.slice(2);
  if (d.length > 11) d = d.slice(-11);

  // Celular BR digitado sem nono dígito: DDD + 8 dígitos.
  // Ex.: 5189667504 -> 51989667504
  if (d.length === 10 && d.slice(2, 3) !== '9') {
    d = d.slice(0, 2) + '9' + d.slice(2);
  }

  return d;
}

function toast(message) {
  const box = $('toast');
  if (!box) return alert(message);

  box.textContent = message;
  box.classList.remove('hidden');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 4600);
}

function makeToken() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function cleanName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

function formatDate(date, time) {
  const [y, m, d] = String(date || '').split('-');
  const br = y && m && d ? `${d}/${m}/${y}` : date;
  return `${br || 'Data'}${time ? ` às ${time}` : ''}`;
}

function requiredPlayers(sport) {
  const base = Number(sport?.playersPerTeam || 0) * Number(sport?.teams || 0);
  return Math.max(base + Math.ceil(base * (Number(sport?.reservePercent || 0) / 100)), base, 0);
}

function waitUser() {
  return new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);

    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });

    setTimeout(() => {
      try { unsub(); } catch (_) {}
      resolve(auth.currentUser || null);
    }, 2500);
  });
}

async function loadArena() {
  const arenaId = sessionStorage.getItem('arenaZeroArenaId');
  if (!arenaId) return null;

  const snap = await getDoc(doc(db, 'arenas', arenaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function getOrCreatePlayer(name, phone) {
  const normalizedPhone = normalizeBrazilPhone(phone);

  const snap = await getDocs(
    query(
      collection(db, 'players'),
      where('phone', '==', normalizedPhone),
      limit(1)
    )
  );

  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  const player = {
    name,
    phone: normalizedPhone,
    xp: 0,
    mmr: 1000,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    bestPlayerCount: 0,
    statsBySport: {},
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  const ref = await addDoc(collection(db, 'players'), player);
  return { id: ref.id, ...player };
}

function inviteUrl(match) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `partida=${match.token}`;
  return url.toString();
}

function mapUrl(arena, court) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena?.name || 'Arena'} ${court?.name || ''}`.trim())}`;
}

function shareText(match) {
  return `⚔️ Convocação Arena Zerø

━━━━━━━━━━━━━━━━━━━━

🎮 ${match.sport?.name || 'Partida'}
🏟️ ${match.arena?.name || 'Arena'}
📍 ${match.court?.name || 'Quadra'}
📅 ${formatDate(match.date, match.time)}
👥 ${(match.players || []).length}/${match.required || 0} confirmados

Entre e confirme presença:

👉 ${inviteUrl(match)}

📍 Acesse o mapa:
${mapUrl(match.arena, match.court)}`;
}

function openCaptainWhatsApp(phone, text) {
  const normalized = normalizeBrazilPhone(phone);
  window.open(`https://wa.me/55${normalized}?text=${encodeURIComponent(text)}`, '_blank');
}

async function createMatchFixed() {
  try {
    const user = await waitUser();

    if (!user) {
      toast('Sessão expirada. Saia e entre no painel novamente.');
      return;
    }

    const arena = await loadArena();

    if (!arena) {
      toast('Arena não encontrada. Faça login novamente.');
      return;
    }

    if (arena.ownerUid && arena.ownerUid !== user.uid) {
      toast('Esta arena pertence a outra autenticação. Faça login novamente.');
      return;
    }

    const sport = (arena.sports || []).find((s) => s.id === $('match-sport')?.value);
    const court = (arena.courts || []).find((c) => c.id === $('match-court')?.value);
    const date = $('match-date')?.value || '';
    const time = $('match-time')?.value || '';
    const captainName = cleanName($('match-captain-name')?.value || '');
    const captainPhone = normalizeBrazilPhone($('match-captain-phone')?.value || '');

    if (!sport || !court) return toast('Selecione quadra e esporte.');
    if (!date || !time) return toast('Selecione data e horário.');
    if (!captainName || captainPhone.length < 10) return toast('Informe nome e WhatsApp do capitão.');

    const player = await getOrCreatePlayer(captainName, captainPhone);

    const match = {
      token: makeToken(),
      arenaId: arena.id,
      ownerUid: user.uid,
      arena: {
        id: arena.id,
        name: arena.name,
        phone: arena.phone,
        courts: arena.courts || [],
        sports: arena.sports || []
      },
      sportId: sport.id,
      sport,
      courtId: court.id,
      court,
      date,
      time,
      captainName,
      captainPhone,
      required: requiredPlayers(sport),
      status: 'aberta',
      players: [{
        id: makeToken(),
        playerId: player.id,
        name: player.name || captainName,
        phone: player.phone || captainPhone,
        role: 'capitao',
        team: 'team1',
        joinedAt: nowIso(),
        xpEarned: 0,
        mmrDelta: 0
      }],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const ref = await addDoc(collection(db, 'matches'), match);
    const savedMatch = { id: ref.id, ...match };

    toast('Reserva salva. Abrindo WhatsApp do capitão.');
    openCaptainWhatsApp(captainPhone, shareText(savedMatch));

    setTimeout(() => location.reload(), 900);
  } catch (error) {
    console.error(error);
    toast(`Erro ao salvar reserva: ${error?.message || error}`);
  }
}

function installReserveFix() {
  if (!window.ArenaApp) {
    setTimeout(installReserveFix, 80);
    return;
  }

  window.ArenaApp.createMatch = createMatchFixed;
}

installReserveFix();
