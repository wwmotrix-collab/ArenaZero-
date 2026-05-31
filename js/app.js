const STORE_KEY = 'arena-zero-v2';
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const onlyDigits = (value = '') => String(value).replace(/\D/g, '');
const cleanPhone = (value = '') => onlyDigits(value).slice(-11);
const defaultData = () => ({ arenas: [], matches: [], session: null });
const load = () => {
  try { return { ...defaultData(), ...(JSON.parse(localStorage.getItem(STORE_KEY)) || JSON.parse(localStorage.getItem('arena-zero-v1')) || {}) }; }
  catch (_) { return defaultData(); }
};
const save = (data) => localStorage.setItem(STORE_KEY, JSON.stringify(data));
let state = load();
let currentMatchId = null;
let lastJoinedPlayer = null;

function toast(message) {
  const box = $('toast');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 2800);
}
function currentArena() { return state.arenas.find((arena) => arena.id === state.session?.arenaId) || null; }
function requiredPlayers(sport) {
  const base = Number(sport?.playersPerTeam || 0) * Number(sport?.teams || 0);
  const reserve = Math.ceil(base * (Number(sport?.reservePercent || 0) / 100));
  return Math.max(base + reserve, base, 0);
}
function startersRequired(sport) { return Number(sport?.playersPerTeam || 0) * Number(sport?.teams || 0); }
function formatDate(date, time) {
  if (!date && !time) return 'Data a confirmar';
  const [y, m, d] = String(date || '').split('-');
  const br = y && m && d ? `${d}/${m}/${y}` : date;
  return `${br || 'Data'}${time ? ` às ${time}` : ''}`;
}
function datePart(date) {
  const [y, m, d] = String(date || '').split('-');
  return y && m && d ? `${d}/${m}` : '--';
}
function sportEmoji(name = '') {
  const n = name.toLowerCase();
  if (n.includes('beach') || n.includes('vôlei') || n.includes('volei')) return '🏐';
  if (n.includes('basquete')) return '🏀';
  if (n.includes('padel') || n.includes('tenis') || n.includes('tênis')) return '🎾';
  if (n.includes('fut')) return '⚽';
  return '⚔️';
}
function initials(name = '') { return (name.trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2) || 'P').toUpperCase(); }
function inviteUrl(match) { const url = new URL(location.href); url.search = ''; url.hash = `partida=${match.token}`; return url.toString(); }
function mapUrl(arena, court) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${arena?.name || 'Arena'} ${court?.name || ''}`.trim())}`; }
function matchRefs(match) {
  const arena = state.arenas.find((item) => item.id === match.arenaId);
  const sport = arena?.sports?.find((item) => item.id === match.sportId);
  const court = arena?.courts?.find((item) => item.id === match.courtId);
  return { arena, sport, court };
}
function shareText(match) {
  const { arena, sport, court } = matchRefs(match);
  const confirmed = match.players?.length || 0;
  return `⚔️ Convocação Arena Zerø\n\n━━━━━━━━━━━━━━━━━━━━\n\n🎮 ${sport?.name || 'Partida'}\n🏟️ ${arena?.name || 'Arena'}\n📍 ${court?.name || 'Quadra'}\n📅 ${formatDate(match.date, match.time)}\n👥 ${confirmed}/${match.required || 0} confirmados\n\nEntre e confirme presença:\n\n👉 ${inviteUrl(match)}\n\n📍 Acesse o mapa:\n${mapUrl(arena, court)}\n\nArena Zerø — O lobby começa aqui`;
}
function whatsAppLink(text, phone = '') { const target = cleanPhone(phone) ? `55${cleanPhone(phone)}` : ''; return `https://wa.me/${target}?text=${encodeURIComponent(text)}`; }
function setTabs(active) {
  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === active));
  $('tab-arena')?.classList.toggle('hidden', active !== 'arena');
  $('tab-player')?.classList.toggle('hidden', active !== 'player');
}
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.add('hidden'));
  const target = $(`screen-${name}`);
  if (target) target.classList.remove('hidden');
  if (name === 'arena-dashboard') renderDashboard();
  if (name === 'settings') renderSettings();
  if (name === 'create-match') renderCreateMatch();
  if (name === 'invite') { gotoInviteStep('lobby'); renderInvite(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function normalizeMatch(match) {
  if (!match) return;
  if (!match.players) match.players = [];
  const { sport } = matchRefs(match);
  if (!match.required) match.required = requiredPlayers(sport);
  const captainPhone = cleanPhone(match.captainPhone || '');
  const hasCaptain = captainPhone && match.players.some((player) => cleanPhone(player.phone) === captainPhone);
  if (captainPhone && match.captainName && !hasCaptain) {
    match.players.unshift({ id: uid(), name: match.captainName, phone: captainPhone, role: 'capitao', joinedAt: match.createdAt || new Date().toISOString() });
    save(state);
  }
}
function registerArena() {
  const name = $('reg-arena-name').value.trim();
  const phone = cleanPhone($('reg-arena-phone').value);
  const password = $('reg-arena-password').value.trim();
  if (!name || phone.length < 10 || password.length < 4) return toast('Preencha nome, WhatsApp válido e senha com 4+ caracteres.');
  if (state.arenas.find((arena) => arena.phone === phone)) return toast('Esse WhatsApp já tem painel. Entre com a senha.');
  const arena = { id: uid(), name, phone, password, courts: [], sports: [] };
  state.arenas.push(arena); state.session = { arenaId: arena.id }; save(state);
  toast('Arena criada. Configure quadras e esportes.'); showScreen('settings');
}
function loginArena() {
  const phone = cleanPhone($('arena-phone').value);
  const password = $('arena-password').value.trim();
  const arena = state.arenas.find((item) => item.phone === phone && item.password === password);
  if (!arena) return toast('Arena não encontrada ou senha incorreta.');
  state.session = { arenaId: arena.id }; save(state); showScreen('arena-dashboard');
}
function logout() { state.session = null; save(state); showScreen('login'); }
function renderDashboard() {
  const arena = currentArena(); if (!arena) return showScreen('login');
  $('arena-name-display').textContent = arena.name || 'Arena';
  $('arena-phone-display').textContent = arena.phone ? `WhatsApp: ${arena.phone}` : '';
  const matches = state.matches.filter((match) => match.arenaId === arena.id); matches.forEach(normalizeMatch);
  $('metric-open').textContent = matches.length; $('metric-courts').textContent = arena.courts.length; $('metric-sports').textContent = arena.sports.length;
  const list = $('matches-list'); list.innerHTML = '';
  if (!matches.length) { list.innerHTML = '<div class="chip"><h4>Nenhuma reserva ainda</h4><p>Crie uma partida para gerar o convite do capitão.</p></div>'; return; }
  matches.slice().reverse().forEach((match) => {
    const { sport, court } = matchRefs(match);
    const card = document.createElement('div'); card.className = 'match-card';
    card.innerHTML = `<h4>${sport?.name || 'Partida'} · ${formatDate(match.date, match.time)}</h4><p>${court?.name || 'Quadra'} · ${match.players.length}/${match.required} confirmados · Capitão ${match.captainName || '-'}</p><div class="actions"><button data-open="${match.token}">Abrir lobby</button><button data-share="${match.id}">WhatsApp</button></div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-open]').forEach((btn) => btn.onclick = () => openMatchFromToken(btn.dataset.open));
  list.querySelectorAll('[data-share]').forEach((btn) => btn.onclick = () => { const match = state.matches.find((item) => item.id === btn.dataset.share); normalizeMatch(match); window.open(whatsAppLink(shareText(match), match.captainPhone), '_blank'); });
}
function renderSettings() {
  const arena = currentArena(); if (!arena) return showScreen('login');
  $('courts-list').innerHTML = arena.courts.length ? '' : '<div class="chip"><p>Nenhuma quadra cadastrada.</p></div>';
  arena.courts.forEach((court) => $('courts-list').insertAdjacentHTML('beforeend', `<div class="chip"><h4>${court.name}</h4></div>`));
  $('sports-list').innerHTML = arena.sports.length ? '' : '<div class="chip"><p>Nenhum esporte cadastrado.</p></div>';
  arena.sports.forEach((sport) => $('sports-list').insertAdjacentHTML('beforeend', `<div class="chip"><h4>${sport.name}</h4><p>${sport.playersPerTeam} por time · ${sport.teams} times · ${requiredPlayers(sport)} vagas · ${sport.duration} min</p></div>`));
}
function addCourt() { const arena = currentArena(); const name = $('court-name').value.trim(); if (!arena || !name) return toast('Informe o nome da quadra.'); arena.courts.push({ id: uid(), name }); $('court-name').value = ''; save(state); renderSettings(); toast('Quadra adicionada.'); }
function addSport() {
  const arena = currentArena(); const name = $('sport-name').value.trim();
  const sport = { id: uid(), name, playersPerTeam: Number($('sport-ppt').value || 0), teams: Number($('sport-teams').value || 0), reservePercent: Number($('sport-reserve').value || 0), duration: Number($('sport-duration').value || 0) };
  if (!arena || !sport.name || sport.playersPerTeam < 1 || sport.teams < 1) return toast('Preencha esporte, players/time e times.');
  arena.sports.push(sport); $('sport-name').value = ''; save(state); renderSettings(); toast('Esporte adicionado.');
}
function showCreateMatch() { const arena = currentArena(); if (!arena) return showScreen('login'); if (!arena.courts.length || !arena.sports.length) return toast('Cadastre pelo menos uma quadra e um esporte antes.'); showScreen('create-match'); }
function renderCreateMatch() {
  const arena = currentArena(); if (!arena) return showScreen('login');
  $('match-court').innerHTML = arena.courts.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  $('match-sport').innerHTML = '<option value="">Selecione</option>' + arena.sports.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  previewCapacity();
}
function previewCapacity() { const arena = currentArena(); const sport = arena?.sports.find((item) => item.id === $('match-sport').value); $('capacity-preview').textContent = sport ? `${requiredPlayers(sport)} vagas totais: ${sport.playersPerTeam} jogadores/time, ${sport.teams} times e ${sport.reservePercent}% de reservas.` : 'Selecione esporte para calcular vagas.'; }
function createMatch() {
  const arena = currentArena(); const sport = arena?.sports.find((item) => item.id === $('match-sport').value);
  if (!arena || !sport) return toast('Selecione o esporte.');
  if (!$('match-court').value || !$('match-date').value || !$('match-time').value) return toast('Selecione quadra, data e horário.');
  const captainName = $('match-captain-name').value.trim(); const captainPhone = cleanPhone($('match-captain-phone').value);
  if (!captainName || captainPhone.length < 10) return toast('Informe nome e WhatsApp do capitão.');
  const match = { id: uid(), token: uid().toUpperCase(), arenaId: arena.id, sportId: sport.id, courtId: $('match-court').value, date: $('match-date').value, time: $('match-time').value, captainName, captainPhone, required: requiredPlayers(sport), players: [{ id: uid(), name: captainName, phone: captainPhone, role: 'capitao', joinedAt: new Date().toISOString() }], createdAt: new Date().toISOString() };
  state.matches.push(match); currentMatchId = match.id; save(state); $('created-share-text').value = shareText(match); showScreen('created');
}
function findMatch(token = '') { const clean = String(token || '').trim().replace(/^.*partida=/, '').replace(/^.*token=/, '').replace(/^#/, ''); const match = state.matches.find((item) => item.token === clean || item.id === clean) || null; if (match) normalizeMatch(match); return match; }
function openMatchFromToken(tokenInput) { const match = findMatch(tokenInput || $('player-token').value); if (!match) return toast('Convocação não encontrada. Confira o token/link.'); currentMatchId = match.id; showScreen('invite'); }

function currentInvite() { const match = state.matches.find((item) => item.id === currentMatchId); if (match) normalizeMatch(match); return match; }
function gotoInviteStep(step) {
  ['lobby','entry','done'].forEach((name) => { $(`invite-step-${name}`)?.classList.toggle('hidden', name !== step); $(`invite-nav-${name}`)?.classList.toggle('on', name === step); });
  if (step === 'lobby') renderInvite();
  if (step === 'entry') renderEntry();
  if (step === 'done') renderConfirmed();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderInvite() {
  const match = currentInvite(); if (!match) return showScreen('login');
  const { arena, sport, court } = matchRefs(match);
  const req = startersRequired(sport) || match.required || 0;
  const total = match.required || requiredPlayers(sport);
  const confirmed = match.players.length;
  const reserveTotal = Math.max(total - req, 0);
  const pct = total ? Math.min(Math.round((confirmed / total) * 100), 100) : 0;
  const ready = confirmed >= req;
  const emoji = sportEmoji(sport?.name);
  $('invite-chip').textContent = `${sport?.name || 'Partida'} · Convocação`;
  $('invite-emoji').textContent = emoji;
  $('invite-sport').textContent = sport?.name || 'Partida';
  $('invite-arena').textContent = `${arena?.name || 'Arena'} · ${court?.name || 'Quadra'}`;
  $('invite-date').textContent = `${formatDate(match.date, match.time)} · ${sport?.duration || '--'} MIN`;
  $('hud-date').textContent = datePart(match.date); $('hud-time').textContent = match.time || '--'; $('hud-court').textContent = (court?.name || 'Quadra').replace(/^Quadra\s*/i,'') || 'A'; $('hud-duration').textContent = `${sport?.duration || '--'} min`;
  $('invite-map-label').textContent = `${arena?.name || 'Arena'} · Ver no mapa`;
  $('counter-focal').classList.toggle('green-mode', ready); $('cf-dot').className = ready ? 'green' : 'amber';
  $('invite-status').textContent = ready ? (confirmed >= total ? 'Lobby completo' : 'Partida formada') : (confirmed ? 'Partida em formação' : 'Aguardando jogadores');
  $('invite-count').textContent = confirmed; $('invite-required').textContent = req;
  $('invite-lacking').textContent = ready ? `${confirmed}/${total} no lobby` : `${Math.max(req - confirmed, 0)} vagas para formar a partida`;
  $('prog-label').textContent = ready ? (confirmed >= total ? 'Lobby completo' : 'Partida formada · reservas abertas') : `Faltam ${Math.max(req - confirmed, 0)} jogador${Math.max(req - confirmed, 0) === 1 ? '' : 'es'}`;
  $('prog-pct').textContent = `${pct}%`; $('invite-progress').style.width = `${pct}%`; $('prog-goal').style.left = `${total ? Math.round((req / total) * 100) : 0}%`;
  $('btn-open-entry').className = `btn-cta ${confirmed >= total ? 'locked-cta' : 'active-cta'}`; $('btn-open-entry').innerHTML = confirmed >= total ? '🔒 Lobby completo' : '⚡ Entrar na partida';
  renderSlots(match, sport, total, req, reserveTotal, 'mini-slots', 'team1-slots', 'team2-slots', 'reserve-slots', 'team1-count', 'team2-count');
}
function renderSlots(match, sport, total, req, reserveTotal, miniId, t1Id, t2Id, reserveId, t1CountId, t2CountId) {
  const ppt = Number(sport?.playersPerTeam || Math.ceil(req / 2) || 1);
  const players = match.players || [];
  const t1 = players.slice(0, ppt); const t2 = players.slice(ppt, ppt * 2); const reserves = players.slice(req);
  const mini = $(miniId); if (mini) { let html = ''; for (let i=0;i<ppt;i++) html += `<i class="ms ${i<t1.length?'t1':'open'}"></i>`; for (let i=0;i<ppt;i++) html += `<i class="ms ${i<t2.length?'t2':'open'}"></i>`; for (let i=0;i<reserveTotal;i++) html += `<i class="ms ${i<reserves.length?'rs':'open'}"></i>`; mini.innerHTML = html; }
  const slot = (player, team, idx) => player ? `<div class="slot-card sc-${team}"><div class="avatar">${initials(player.name)}</div><div><b>${player.name}${player.role === 'capitao' ? ' ⭐' : ''}</b><span>${player.role === 'capitao' ? 'CAPITÃO' : 'MMR ----'}</span></div><em>#${idx+1}</em></div>` : `<div class="slot-card empty"><i>+</i><span>Aguardando</span><em>#${idx+1}</em></div>`;
  if ($(t1Id)) { let h=''; for (let i=0;i<ppt;i++) h += slot(t1[i], 't1', i); $(t1Id).innerHTML = h; }
  if ($(t2Id)) { let h=''; for (let i=0;i<ppt;i++) h += slot(t2[i], 't2', i); $(t2Id).innerHTML = h; }
  if ($(t1CountId)) $(t1CountId).textContent = `${t1.length}/${ppt}`; if ($(t2CountId)) $(t2CountId).textContent = `${t2.length}/${ppt}`;
  if ($(reserveId)) { let h=''; if (!reserveTotal) h = '<div class="reserve-empty">Sem reservas neste esporte</div>'; else for (let i=0;i<reserveTotal;i++) h += reserves[i] ? `<div class="res-row filled"><b>${i+1}</b><span>${reserves[i].name}</span><em>Reserva</em></div>` : `<div class="res-row"><b>${i+1}</b><span>Vaga disponível</span></div>`; $(reserveId).innerHTML = h; }
}
function renderEntry() {
  const match = currentInvite(); if (!match) return;
  const { arena, sport } = matchRefs(match); const emoji = sportEmoji(sport?.name);
  $('entry-eye').textContent = `${sport?.name || 'Partida'} · ${arena?.name || 'Arena'}`; $('entry-emoji').textContent = emoji; $('entry-sport').textContent = sport?.name || 'Partida'; $('entry-meta').textContent = `${formatDate(match.date, match.time)} · ${arena?.name || 'Arena'}`; checkJoinForm();
}
function checkJoinForm() { const ok = ($('join-name')?.value.trim().length || 0) >= 2 && cleanPhone($('join-phone')?.value || '').length >= 10; if ($('btn-confirm-join')) $('btn-confirm-join').disabled = !ok; }
function joinMatch() {
  const match = currentInvite(); if (!match) return toast('Abra uma convocação primeiro.');
  const name = $('join-name').value.trim(); const phone = cleanPhone($('join-phone').value);
  if (!name || phone.length < 10) return toast('Informe seu nome e WhatsApp.');
  if (match.players.some((player) => cleanPhone(player.phone) === phone)) return toast('Esse WhatsApp já confirmou presença.');
  if (match.players.length >= match.required) return toast('O lobby já está completo.');
  const player = { id: uid(), name, phone, role: 'player', joinedAt: new Date().toISOString() };
  match.players.push(player); lastJoinedPlayer = player; save(state); $('join-name').value = ''; $('join-phone').value = ''; checkJoinForm(); toast('Presença confirmada.'); gotoInviteStep('done');
}
function renderConfirmed() {
  const match = currentInvite(); if (!match) return;
  const { arena, sport } = matchRefs(match); const req = startersRequired(sport) || match.required; const ppt = Number(sport?.playersPerTeam || Math.ceil(req/2) || 1); const idx = Math.max(match.players.findIndex(p => p.id === lastJoinedPlayer?.id), match.players.length - 1); const isReserve = idx >= req; const team = idx < ppt ? 'TIME 1' : idx < req ? 'TIME 2' : 'RESERVA';
  $('confirmed-tag').textContent = team; $('confirmed-title').textContent = isReserve ? 'Em espera' : 'Vaga garantida'; $('confirmed-sub').textContent = isReserve ? `Você é reserva #${idx - req + 1} · sobe se alguém sair` : `Você entrou para o ${team} · posição ${idx < ppt ? idx + 1 : idx - ppt + 1}`;
  $('confirmed-event-name').textContent = `${sportEmoji(sport?.name)} ${sport?.name || 'Partida'}`; $('confirmed-event-meta').textContent = `${formatDate(match.date, match.time)} · ${arena?.name || 'Arena'}`;
  const pct = Math.min(Math.round((match.players.length / Math.max(match.required, 1)) * 100), 100); $('done-progress').style.width = `${pct}%`; $('done-prog-label').textContent = `${match.players.length}/${match.required} confirmados`; $('done-prog-pct').textContent = `${pct}%`;
  renderSlots(match, sport, match.required, req, Math.max(match.required - req, 0), 'done-mini-slots');
}
function openMap() { const match = currentInvite(); if (!match) return; const { arena, court } = matchRefs(match); window.open(mapUrl(arena, court), '_blank'); }
async function shareCurrentMatch() { const match = currentInvite(); if (!match) return toast('Abra uma convocação primeiro.'); const text = shareText(match); if (navigator.share) { try { await navigator.share({ text }); return; } catch (_) {} } window.open(whatsAppLink(text), '_blank'); }
function shareCreatedMatch() { const match = currentInvite(); if (!match) return toast('Reserva não encontrada.'); window.open(whatsAppLink(shareText(match), match.captainPhone), '_blank'); }
function initDeepLink() { const hash = decodeURIComponent(location.hash || ''); const params = new URLSearchParams(location.search); const token = params.get('partida') || params.get('token') || (hash.includes('partida=') ? hash.split('partida=')[1] : ''); if (token) { const match = findMatch(token); if (match) { currentMatchId = match.id; showScreen('invite'); return true; } } return false; }
function seedIfEmpty() { if (state.arenas.length) return; const arena = { id: uid(), name: 'Zero', phone: '51999999999', password: '1234', courts: [{ id: uid(), name: 'Quadra A' }], sports: [{ id: uid(), name: 'Beach', playersPerTeam: 2, teams: 2, reservePercent: 50, duration: 60 }] }; state.arenas.push(arena); save(state); }
window.ArenaApp = { showScreen, registerArena, loginArena, logout, addCourt, addSport, showCreateMatch, previewCapacity, createMatch, openMatchFromToken, joinMatch, shareCurrentMatch, shareCreatedMatch, gotoInviteStep, checkJoinForm, openMap };
document.querySelectorAll('.tab-btn').forEach((btn) => btn.addEventListener('click', () => setTabs(btn.dataset.tab)));
seedIfEmpty(); state.matches.forEach(normalizeMatch); save(state);
if (!initDeepLink()) showScreen(state.session?.arenaId ? 'arena-dashboard' : 'login');
