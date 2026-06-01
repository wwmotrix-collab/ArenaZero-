import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

const st = {
  date: ymd(new Date()),
  period: 'day',
  view: 'day',
  court: 'all',
  sport: 'all',
  arena: null,
  matches: []
};

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }

// Calendário robusto: não usa ISO/UTC para comparar datas. Só string YYYY-MM-DD.
function parseYmd(value) {
  const [year, month, day] = String(value || ymd(new Date())).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function addDays(value, amount) {
  const date = parseYmd(value);
  date.setDate(date.getDate() + amount);
  return ymd(date);
}

function weekStart(value) {
  const date = parseYmd(value);
  date.setDate(date.getDate() - date.getDay());
  return ymd(date);
}

function weekEnd(value) { return addDays(weekStart(value), 6); }
function monthStart(value) {
  const date = parseYmd(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}
function monthEnd(value) {
  const date = parseYmd(value);
  return ymd(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0));
}
function brDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '--';
}
function brShort(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}` : '--';
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function toast(message) {
  const box = $('toast');
  if (!box) return alert(message);
  box.textContent = message;
  box.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 4200);
}

function matchStatus(match) {
  const value = String(match?.status || 'aberta').toLowerCase();
  if (value.includes('cancel')) return 'cancelada';
  if (value.includes('final')) return 'finalizada';
  if (value.includes('formada') || value.includes('andamento')) return 'formada';
  return 'aberta';
}
function statusLabel(value) {
  const status = matchStatus({ status: value });
  return { aberta: 'Aberta', formada: 'Formada', finalizada: 'Finalizada', cancelada: 'Cancelada' }[status] || 'Aberta';
}
function confirmed(match) { return (match.players || []).length; }
function required(match) { return Number(match.required || 0); }
function sportName(match) { return escapeHtml(match?.sport?.name || 'Partida'); }
function courtName(match) { return escapeHtml(match?.court?.name || 'Quadra'); }

function periodRange() {
  if (st.period === 'week') return [weekStart(st.date), weekEnd(st.date)];
  if (st.period === 'month') return [monthStart(st.date), monthEnd(st.date)];
  return [st.date, st.date];
}
function filteredMatches(range = periodRange()) {
  const [start, end] = range;
  return st.matches
    .filter((match) => (match.date || '') >= start && (match.date || '') <= end)
    .filter((match) => st.court === 'all' || match.courtId === st.court)
    .filter((match) => st.sport === 'all' || match.sportId === st.sport)
    .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));
}

async function loadData() {
  const arenaId = sessionStorage.getItem('arenaZeroArenaId');
  if (!arenaId) return false;
  const arenaSnap = await getDoc(doc(db, 'arenas', arenaId));
  if (!arenaSnap.exists()) return false;
  st.arena = { id: arenaSnap.id, ...arenaSnap.data() };
  const matchesSnap = await getDocs(query(collection(db, 'matches'), where('arenaId', '==', arenaId)));
  st.matches = matchesSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
  return true;
}

function injectStyle() {
  if ($('azp-style')) return;
  const style = document.createElement('style');
  style.id = 'azp-style';
  style.textContent = `
    .azp { margin-top: 18px; }
    .azbox { border: 1px solid rgba(255,255,255,.14); background: linear-gradient(135deg,rgba(255,255,255,.08),rgba(255,255,255,.03)); border-radius: 22px; padding: 16px; margin: 16px 0; }
    .aztitle { text-transform: uppercase; letter-spacing: .08em; margin: 0 0 12px; }
    .azrow { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
    .azbtn, .azsel, .azdate { border: 1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.07); color: #fff; border-radius: 14px; padding: 10px 12px; font-weight: 800; }
    .azbtn.on { background: linear-gradient(90deg,#a9ff00,#00f59a); color: #07100c; }
    .azkpis { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
    .azkpi { border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 12px; background: rgba(0,0,0,.18); }
    .azkpi span { display: block; color: rgba(255,255,255,.62); text-transform: uppercase; font-size: .78rem; font-weight: 900; }
    .azkpi b { font-size: 1.8rem; }
    .azcard { border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(0,0,0,.2); padding: 12px; margin: 10px 0; }
    .azcard.cancelada { opacity: .55; }
    .azhead { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.12); padding-bottom: 8px; margin-bottom: 10px; }
    .azstatus { display: inline-block; border-radius: 999px; padding: 4px 9px; font-size: .75rem; font-weight: 900; }
    .azstatus.aberta { background: #114a38; color: #42ff9b; }
    .azstatus.formada { background: #3d3300; color: #ffc400; }
    .azstatus.finalizada { background: #1f2d45; color: #70b7ff; }
    .azstatus.cancelada { background: #4a1111; color: #ff7171; }
    .azact { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
    .azact button { border: 0; border-radius: 12px; padding: 9px 11px; font-weight: 900; }
    .azcancel { background: #3b1717; color: #ffb0b0; }
    .azwhats { background: #113d2a; color: #7cffb1; }
    .azempty { padding: 14px; border: 1px dashed rgba(255,255,255,.18); border-radius: 18px; color: rgba(255,255,255,.65); }
    .azmonth { display: grid; grid-template-columns: repeat(7,1fr); gap: 6px; }
    .azdaycell { min-height: 68px; border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 7px; background: rgba(0,0,0,.18); color: #fff; text-align: left; }
    .azcourts { display: grid; gap: 10px; }
    .azslot { display: flex; justify-content: space-between; border-radius: 12px; padding: 9px; margin: 6px 0; background: rgba(255,255,255,.06); border-left: 4px solid #00f59a; }
    @media (min-width:720px) { .azkpis { grid-template-columns: repeat(5,1fr); } .azcourts { grid-template-columns: repeat(2,1fr); } }
  `;
  document.head.appendChild(style);
}

function ensureShell() {
  const dashboard = $('screen-arena-dashboard');
  if (!dashboard || $('azp')) return;
  const root = document.createElement('div');
  root.id = 'azp';
  root.className = 'azp';
  const anchor = [...dashboard.querySelectorAll('.section-title')].find((item) => item.textContent.includes('Partidas'));
  dashboard.insertBefore(root, anchor || null);
}

function renderControls() {
  const courts = st.arena?.courts || [];
  const sports = st.arena?.sports || [];
  return `
    <div class="azrow">
      ${[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([value, label]) => `<button class="azbtn ${st.period === value ? 'on' : ''}" data-period="${value}">${label}</button>`).join('')}
    </div>
    <div class="azrow">
      <input class="azdate" id="azdate" type="date" value="${st.date}">
      <select class="azsel" id="azcourt"><option value="all">Todas quadras</option>${courts.map((court) => `<option value="${court.id}" ${st.court === court.id ? 'selected' : ''}>${escapeHtml(court.name)}</option>`).join('')}</select>
      <select class="azsel" id="azsport"><option value="all">Todos esportes</option>${sports.map((sport) => `<option value="${sport.id}" ${st.sport === sport.id ? 'selected' : ''}>${escapeHtml(sport.name)}</option>`).join('')}</select>
    </div>
    <div class="azrow">
      ${[['day', 'Calendário Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([value, label]) => `<button class="azbtn ${st.view === value ? 'on' : ''}" data-view="${value}">${label}</button>`).join('')}
    </div>
  `;
}

function renderSummary() {
  const list = filteredMatches();
  const active = list.filter((match) => matchStatus(match) !== 'cancelada');
  const data = {
    reservations: active.length,
    open: active.filter((match) => matchStatus(match) === 'aberta').length,
    formed: active.filter((match) => matchStatus(match) === 'formada').length,
    occupied: new Set(active.map((match) => `${match.date}|${match.time}|${match.courtId}`)).size,
    players: active.reduce((total, match) => total + confirmed(match), 0)
  };
  return `<div class="azbox"><h3 class="aztitle">Resumo ${st.period === 'day' ? 'do dia' : st.period === 'week' ? 'da semana' : 'do mês'}</h3><div class="azkpis"><div class="azkpi"><span>Reservas</span><b>${data.reservations}</b></div><div class="azkpi"><span>Abertas</span><b>${data.open}</b></div><div class="azkpi"><span>Formadas</span><b>${data.formed}</b></div><div class="azkpi"><span>Quadras ocupadas</span><b>${data.occupied}</b></div><div class="azkpi"><span>Jogadores</span><b>${data.players}</b></div></div></div>`;
}

function renderCalendar() {
  if (st.view === 'month') return renderMonth();
  if (st.view === 'week') return renderWeek();
  return `<div class="azbox"><h3 class="aztitle">Calendário do dia</h3>${renderDay(st.date)}</div>`;
}

function renderDay(date) {
  const matches = filteredMatches([date, date]);
  return `<div><div class="azhead"><b>${brDate(date)}</b><span>${matches.length} reserva(s)</span></div>${matches.length ? matches.map(renderCard).join('') : '<div class="azempty">Nenhuma reserva.</div>'}</div>`;
}

function renderWeek() {
  const start = weekStart(st.date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  return `<div class="azbox"><h3 class="aztitle">Calendário da semana</h3>${days.map(renderDay).join('')}</div>`;
}

function renderMonth() {
  const days = [];
  const end = monthEnd(st.date);
  for (let date = parseYmd(monthStart(st.date)); ymd(date) <= end; date.setDate(date.getDate() + 1)) days.push(ymd(date));
  return `<div class="azbox"><h3 class="aztitle">Calendário do mês</h3><div class="azmonth">${days.map((day) => `<button class="azdaycell" data-pick="${day}"><b>${brShort(day)}</b><br><small>${filteredMatches([day, day]).length} reserva(s)</small></button>`).join('')}</div></div>`;
}

function renderAgendaByCourt() {
  const courts = st.arena?.courts || [];
  const matches = filteredMatches();
  return `<div class="azbox"><h3 class="aztitle">Agenda por quadra</h3><div class="azcourts">${courts.length ? courts.map((court) => {
    const items = matches.filter((match) => match.courtId === court.id);
    return `<div><h4>${escapeHtml(court.name)}</h4>${items.length ? items.map((match) => `<div class="azslot"><span>${brShort(match.date)} ${escapeHtml(match.time || '--:--')}</span><b>${sportName(match)}</b></div>`).join('') : '<div class="azempty">Sem reservas</div>'}</div>`;
  }).join('') : '<div class="azempty">Cadastre quadras.</div>'}</div></div>`;
}

function renderGroups() {
  const matches = filteredMatches();
  return `<div class="azbox"><h3 class="aztitle">Partidas</h3>${['aberta', 'formada', 'finalizada', 'cancelada'].map((item) => {
    const group = matches.filter((match) => matchStatus(match) === item);
    return `<div><div class="azhead"><b>${statusLabel(item)}</b><span>${group.length}</span></div>${group.length ? group.map(renderCard).join('') : '<div class="azempty">Nenhuma.</div>'}</div>`;
  }).join('')}</div>`;
}

function renderCard(match) {
  const status = matchStatus(match);
  const canCancel = status !== 'cancelada' && status !== 'finalizada';
  return `<div class="azcard ${status}"><h4>${sportName(match)} · ${courtName(match)}</h4><p>${brDate(match.date)} às ${escapeHtml(match.time || '--:--')} · ${confirmed(match)}/${required(match)} confirmados</p><p>Capitão: ${escapeHtml(match.captainName || '—')} · ${escapeHtml(match.captainPhone || '')}</p><span class="azstatus ${status}">${statusLabel(status)}</span><div class="azact"><button class="azwhats" data-share="${match.id}">WhatsApp</button>${canCancel ? `<button class="azcancel" data-cancel="${match.id}">Cancelar partida</button>` : ''}</div></div>`;
}

function inviteUrl(match) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = `partida=${match.token}`;
  return url.toString();
}

function shareText(match) {
  return `⚔️ Convocação Arena Zerø\n\n━━━━━━━━━━━━━━━━━━━━\n\n🎮 ${match?.sport?.name || 'Partida'}\n🏟️ ${match?.arena?.name || st.arena?.name || 'Arena'}\n📍 ${match?.court?.name || 'Quadra'}\n📅 ${brDate(match.date)} às ${match.time || '--:--'}\n👥 ${confirmed(match)}/${required(match)} confirmados\n\nEntre e confirme presença:\n\n👉 ${inviteUrl(match)}`;
}

function openWhatsApp(match) {
  if (!match) return;
  const phone = String(match.captainPhone || '').replace(/\D/g, '');
  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(shareText(match))}`, '_blank');
}

async function cancelMatch(id) {
  const match = st.matches.find((item) => item.id === id);
  if (!match) return;
  const ok = confirm(`Cancelar ${match?.sport?.name || 'partida'} em ${brDate(match.date)} às ${match.time || '--:--'}?`);
  if (!ok) return;
  await updateDoc(doc(db, 'matches', id), { status: 'cancelada', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  toast('Partida cancelada.');
  await render();
}

function wire() {
  document.querySelectorAll('[data-period]').forEach((button) => {
    button.onclick = () => { st.period = button.dataset.period; render(); };
  });
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = () => { st.view = button.dataset.view; render(); };
  });
  $('azdate')?.addEventListener('change', (event) => { st.date = event.target.value || ymd(new Date()); render(); });
  $('azcourt')?.addEventListener('change', (event) => { st.court = event.target.value; render(); });
  $('azsport')?.addEventListener('change', (event) => { st.sport = event.target.value; render(); });
  document.querySelectorAll('[data-share]').forEach((button) => { button.onclick = () => openWhatsApp(st.matches.find((match) => match.id === button.dataset.share)); });
  document.querySelectorAll('[data-cancel]').forEach((button) => { button.onclick = () => cancelMatch(button.dataset.cancel); });
  document.querySelectorAll('[data-pick]').forEach((button) => { button.onclick = () => { st.date = button.dataset.pick; st.period = 'day'; st.view = 'day'; render(); }; });
}

async function render() {
  const root = $('azp');
  if (!root) return;
  if (!(await loadData())) return;
  root.innerHTML = `${renderControls()}${renderSummary()}${renderCalendar()}${renderAgendaByCourt()}${renderGroups()}<div class="azbox"><h3 class="aztitle">Insights da IA</h3><div class="azempty">Aguardando histórico suficiente para gerar insights de ocupação, risco de partida e XP/MMR.</div></div>`;
  wire();
}

function install() {
  injectStyle();
  ensureShell();
  render();
  setTimeout(install, 3000);
}

install();
