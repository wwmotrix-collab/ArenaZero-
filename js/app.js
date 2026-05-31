const STORE_KEY = 'arena-zero-v2';

const $ = (id) => document.getElementById(id);

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const onlyDigits = (value = '') => String(value).replace(/\D/g, '');
const cleanPhone = (value = '') => onlyDigits(value).slice(-11);

const defaultData = () => ({ arenas: [], matches: [], session: null });

const load = () => {
  try {
    return { ...defaultData(), ...(JSON.parse(localStorage.getItem(STORE_KEY)) || JSON.parse(localStorage.getItem('arena-zero-v1')) || {}) };
  } catch (_) {
    return defaultData();
  }
};

const save = (data) => localStorage.setItem(STORE_KEY, JSON.stringify(data));

let state = load();
let currentMatchId = null;

function toast(message) {
  const box = $('toast');
  box.textContent = message;
  box.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 2800);
}

function currentArena() {
  return state.arenas.find((arena) => arena.id === state.session?.arenaId) || null;
}

function requiredPlayers(sport) {
  const base = Number(sport?.playersPerTeam || 0) * Number(sport?.teams || 0);
  const reserve = Math.ceil(base * (Number(sport?.reservePercent || 0) / 100));
  return Math.max(base + reserve, base, 0);
}

function formatDate(date, time) {
  if (!date && !time) return 'Data a confirmar';
  const [y, m, d] = String(date || '').split('-');
  const br = y && m && d ? `${d}/${m}/${y}` : date;
  return `${br || 'Data'}${time ? ` às ${time}` : ''}`;
}

function inviteUrl(match) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `partida=${match.token}`;
  return url.toString();
}

function mapUrl(arena, court) {
  const query = encodeURIComponent(`${arena?.name || 'Arena'} ${court?.name || ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function matchRefs(match) {
  const arena = state.arenas.find((item) => item.id === match.arenaId);
  const sport = arena?.sports?.find((item) => item.id === match.sportId);
  const court = arena?.courts?.find((item) => item.id === match.courtId);
  return { arena, sport, court };
}

function shareText(match) {
  const { arena, sport, court } = matchRefs(match);
  const confirmed = match.players?.length || 0;
  return `⚔️ Convocação Arena Zerø

━━━━━━━━━━━━━━━━━━━━

🎮 ${sport?.name || 'Partida'}
🏟️ ${arena?.name || 'Arena'}
📍 ${court?.name || 'Quadra'}
📅 ${formatDate(match.date, match.time)}
👥 ${confirmed}/${match.required || 0} confirmados

Entre e confirme presença:

👉 ${inviteUrl(match)}

📍 Acesse o mapa:
${mapUrl(arena, court)}

Arena Zerø — O lobby começa aqui`;
}

function whatsAppLink(text, phone = '') {
  const digits = cleanPhone(phone);
  const target = digits ? `55${digits}` : '';
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

function setTabs(active) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === active));
  $('tab-arena').classList.toggle('hidden', active !== 'arena');
  $('tab-player').classList.toggle('hidden', active !== 'player');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.add('hidden'));
  const target = $(`screen-${name}`);
  if (target) target.classList.remove('hidden');
  if (name === 'arena-dashboard') renderDashboard();
  if (name === 'settings') renderSettings();
  if (name === 'create-match') renderCreateMatch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function normalizeMatch(match) {
  if (!match) return;
  if (!match.players) match.players = [];
  if (!match.required) {
    const { sport } = matchRefs(match);
    match.required = requiredPlayers(sport);
  }
  const captainPhone = cleanPhone(match.captainPhone || '');
  const hasCaptain = captainPhone && match.players.some((player) => cleanPhone(player.phone) === captainPhone);
  if (captainPhone && match.captainName && !hasCaptain) {
    match.players.unshift({
      id: uid(),
      name: match.captainName,
      phone: captainPhone,
      role: 'capitao',
      joinedAt: match.createdAt || new Date().toISOString(),
    });
    save(state);
  }
}

function registerArena() {
  const name = $('reg-arena-name').value.trim();
  const phone = cleanPhone($('reg-arena-phone').value);
  const password = $('reg-arena-password').value.trim();
  if (!name || phone.length < 10 || password.length < 4) return toast('Preencha nome, WhatsApp válido e senha com 4+ caracteres.');
  const existing = state.arenas.find((arena) => arena.phone === phone);
  if (existing) return toast('Esse WhatsApp já tem painel. Entre com a senha.');
  const arena = { id: uid(), name, phone, password, courts: [], sports: [] };
  state.arenas.push(arena);
  state.session = { arenaId: arena.id };
  save(state);
  toast('Arena criada. Configure quadras e esportes.');
  showScreen('settings');
}

function loginArena() {
  const phone = cleanPhone($('arena-phone').value);
  const password = $('arena-password').value.trim();
  const arena = state.arenas.find((item) => item.phone === phone && item.password === password);
  if (!arena) return toast('Arena não encontrada ou senha incorreta.');
  state.session = { arenaId: arena.id };
  save(state);
  showScreen('arena-dashboard');
}

function logout() {
  state.session = null;
  save(state);
  showScreen('login');
}

function renderDashboard() {
  const arena = currentArena();
  if (!arena) return showScreen('login');
  $('arena-name-display').textContent = arena.name || 'Arena';
  $('arena-phone-display').textContent = arena.phone ? `WhatsApp: ${arena.phone}` : '';
  const matches = state.matches.filter((match) => match.arenaId === arena.id);
  matches.forEach(normalizeMatch);
  $('metric-open').textContent = matches.length;
  $('metric-courts').textContent = arena.courts.length;
  $('metric-sports').textContent = arena.sports.length;
  const list = $('matches-list');
  list.innerHTML = '';
  if (!matches.length) {
    list.innerHTML = '<div class="chip"><h4>Nenhuma reserva ainda</h4><p>Crie uma partida para gerar o convite do capitão.</p></div>';
    return;
  }
  matches.slice().reverse().forEach((match) => {
    const { sport, court } = matchRefs(match);
    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `<h4>${sport?.name || 'Partida'} · ${formatDate(match.date, match.time)}</h4><p>${court?.name || 'Quadra'} · ${match.players.length}/${match.required} confirmados · Capitão ${match.captainName || '-'}</p><div class="actions"><button data-open="${match.token}">Abrir lobby</button><button data-share="${match.id}">WhatsApp</button></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-open]').forEach((btn) => btn.onclick = () => openMatchFromToken(btn.dataset.open));
  list.querySelectorAll('[data-share]').forEach((btn) => btn.onclick = () => {
    const match = state.matches.find((item) => item.id === btn.dataset.share);
    normalizeMatch(match);
    window.open(whatsAppLink(shareText(match), match.captainPhone), '_blank');
  });
}

function renderSettings() {
  const arena = currentArena();
  if (!arena) return showScreen('login');
  const courts = $('courts-list');
  courts.innerHTML = arena.courts.length ? '' : '<div class="chip"><p>Nenhuma quadra cadastrada.</p></div>';
  arena.courts.forEach((court) => courts.insertAdjacentHTML('beforeend', `<div class="chip"><h4>${court.name}</h4></div>`));
  const sports = $('sports-list');
  sports.innerHTML = arena.sports.length ? '' : '<div class="chip"><p>Nenhum esporte cadastrado.</p></div>';
  arena.sports.forEach((sport) => sports.insertAdjacentHTML('beforeend', `<div class="chip"><h4>${sport.name}</h4><p>${sport.playersPerTeam} por time · ${sport.teams} times · ${requiredPlayers(sport)} vagas · ${sport.duration} min</p></div>`));
}

function addCourt() {
  const arena = currentArena();
  const name = $('court-name').value.trim();
  if (!arena || !name) return toast('Informe o nome da quadra.');
  arena.courts.push({ id: uid(), name });
  $('court-name').value = '';
  save(state);
  renderSettings();
  toast('Quadra adicionada.');
}

function addSport() {
  const arena = currentArena();
  const name = $('sport-name').value.trim();
  const sport = {
    id: uid(),
    name,
    playersPerTeam: Number($('sport-ppt').value || 0),
    teams: Number($('sport-teams').value || 0),
    reservePercent: Number($('sport-reserve').value || 0),
    duration: Number($('sport-duration').value || 0),
  };
  if (!arena || !sport.name || sport.playersPerTeam < 1 || sport.teams < 1) return toast('Preencha esporte, players/time e times.');
  arena.sports.push(sport);
  $('sport-name').value = '';
  save(state);
  renderSettings();
  toast('Esporte adicionado.');
}

function showCreateMatch() {
  const arena = currentArena();
  if (!arena) return showScreen('login');
  if (!arena.courts.length || !arena.sports.length) return toast('Cadastre pelo menos uma quadra e um esporte antes.');
  showScreen('create-match');
}

function renderCreateMatch() {
  const arena = currentArena();
  if (!arena) return showScreen('login');
  const court = $('match-court');
  const sport = $('match-sport');
  court.innerHTML = arena.courts.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  sport.innerHTML = '<option value="">Selecione</option>' + arena.sports.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  previewCapacity();
}

function previewCapacity() {
  const arena = currentArena();
  const sport = arena?.sports.find((item) => item.id === $('match-sport').value);
  $('capacity-preview').textContent = sport ? `${requiredPlayers(sport)} vagas totais: ${sport.playersPerTeam} jogadores/time, ${sport.teams} times e ${sport.reservePercent}% de reservas.` : 'Selecione esporte para calcular vagas.';
}

function createMatch() {
  const arena = currentArena();
  const sport = arena?.sports.find((item) => item.id === $('match-sport').value);
  if (!arena || !sport) return toast('Selecione o esporte.');
  if (!$('match-court').value || !$('match-date').value || !$('match-time').value) return toast('Selecione quadra, data e horário.');
  const captainName = $('match-captain-name').value.trim();
  const captainPhone = cleanPhone($('match-captain-phone').value);
  if (!captainName || captainPhone.length < 10) return toast('Informe nome e WhatsApp do capitão.');
  const match = {
    id: uid(),
    token: uid().toUpperCase(),
    arenaId: arena.id,
    sportId: sport.id,
    courtId: $('match-court').value,
    date: $('match-date').value,
    time: $('match-time').value,
    captainName,
    captainPhone,
    required: requiredPlayers(sport),
    players: [{ id: uid(), name: captainName, phone: captainPhone, role: 'capitao', joinedAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  state.matches.push(match);
  currentMatchId = match.id;
  save(state);
  $('created-share-text').value = shareText(match);
  showScreen('created');
}

function findMatch(token = '') {
  const clean = String(token || '').trim().replace(/^.*partida=/, '').replace(/^.*token=/, '').replace(/^#/, '');
  const match = state.matches.find((item) => item.token === clean || item.id === clean) || null;
  if (match) normalizeMatch(match);
  return match;
}

function openMatchFromToken(tokenInput) {
  const token = tokenInput || $('player-token').value;
  const match = findMatch(token);
  if (!match) return toast('Convocação não encontrada. Confira o token/link.');
  currentMatchId = match.id;
  showScreen('invite');
  renderInvite();
}

function renderInvite() {
  const match = state.matches.find((item) => item.id === currentMatchId);
  if (!match) return showScreen('login');
  normalizeMatch(match);
  const { arena, sport, court } = matchRefs(match);
  $('invite-status').textContent = match.players.length >= match.required ? 'Partida fechada' : 'Convocação aberta';
  $('invite-sport').textContent = sport?.name || 'Partida';
  $('invite-arena').textContent = `${arena?.name || 'Arena'} · ${court?.name || 'Quadra'}`;
  $('invite-date').textContent = formatDate(match.date, match.time);
  $('invite-count').textContent = match.players.length;
  $('invite-required').textContent = match.required;
  const lacking = Math.max(match.required - match.players.length, 0);
  $('invite-lacking').textContent = lacking ? `${lacking} vagas restantes` : 'time completo';
  $('invite-progress').style.width = `${Math.min((match.players.length / Math.max(match.required, 1)) * 100, 100)}%`;
  const roster = $('invite-roster');
  roster.innerHTML = match.players.length ? '' : '<div class="player-card"><span>Ninguém confirmado ainda.</span></div>';
  match.players.forEach((player, index) => {
    const role = player.role === 'capitao' ? 'Capitão · confirmado' : 'Player confirmado';
    roster.insertAdjacentHTML('beforeend', `<div class="player-card"><b>${index + 1}. ${player.name}</b><span>${role}${player.phone ? ` · ${player.phone}` : ''}</span></div>`);
  });
}

function joinMatch() {
  const match = state.matches.find((item) => item.id === currentMatchId);
  const name = $('join-name').value.trim();
  const phone = cleanPhone($('join-phone').value);
  if (!match) return toast('Abra uma convocação primeiro.');
  normalizeMatch(match);
  if (!name || phone.length < 10) return toast('Informe seu nome e WhatsApp.');
  if (match.players.some((player) => cleanPhone(player.phone) === phone)) return toast('Esse WhatsApp já confirmou presença.');
  if (match.players.length >= match.required) return toast('A partida já está completa.');
  match.players.push({ id: uid(), name, phone, role: 'player', joinedAt: new Date().toISOString() });
  save(state);
  $('join-name').value = '';
  $('join-phone').value = '';
  renderInvite();
  toast('Presença confirmada.');
}

async function shareCurrentMatch() {
  const match = state.matches.find((item) => item.id === currentMatchId);
  if (!match) return toast('Abra uma convocação primeiro.');
  normalizeMatch(match);
  const text = shareText(match);
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (_) {}
  }
  window.open(whatsAppLink(text), '_blank');
}

function shareCreatedMatch() {
  const match = state.matches.find((item) => item.id === currentMatchId);
  if (!match) return toast('Reserva não encontrada.');
  normalizeMatch(match);
  window.open(whatsAppLink(shareText(match), match.captainPhone), '_blank');
}

function initDeepLink() {
  const hash = decodeURIComponent(location.hash || '');
  const params = new URLSearchParams(location.search);
  const token = params.get('partida') || params.get('token') || (hash.includes('partida=') ? hash.split('partida=')[1] : '');
  if (token) {
    const match = findMatch(token);
    if (match) {
      currentMatchId = match.id;
      showScreen('invite');
      renderInvite();
      return true;
    }
  }
  return false;
}

function seedIfEmpty() {
  if (state.arenas.length) return;
  const arena = { id: uid(), name: 'Zero', phone: '51999999999', password: '1234', courts: [{ id: uid(), name: 'Quadra A' }], sports: [{ id: uid(), name: 'Beach', playersPerTeam: 2, teams: 2, reservePercent: 50, duration: 60 }] };
  state.arenas.push(arena);
  save(state);
}

window.ArenaApp = { showScreen, registerArena, loginArena, logout, addCourt, addSport, showCreateMatch, previewCapacity, createMatch, openMatchFromToken, joinMatch, shareCurrentMatch, shareCreatedMatch };

document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => setTabs(btn.dataset.tab)));
seedIfEmpty();
state.matches.forEach(normalizeMatch);
save(state);
if (!initDeepLink()) showScreen(state.session?.arenaId ? 'arena-dashboard' : 'login');
