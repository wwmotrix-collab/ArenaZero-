export function ensurePostgameResultModal() {
  let modal = document.getElementById('postgame-result-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'postgame-result-modal';
  modal.className = 'postgame-result-modal hidden';
  modal.innerHTML = `
    <div class="pgr-card">
      <button class="pgr-close" type="button" aria-label="Fechar">×</button>
      <div class="pgr-kicker">XP PENDENTE</div>
      <h3>Confirmar placar</h3>
      <p data-pgr-subtitle>Confirme o resultado para liberar XP e atualizar ranking.</p>

      <label class="pgr-label">WhatsApp usado na convocação</label>
      <input class="pgr-input" data-pgr-phone type="tel" inputmode="numeric" placeholder="(51) 99999-9999" />

      <div class="pgr-score-grid">
        <div>
          <label>Time 1</label>
          <input class="pgr-score" data-pgr-team1 type="number" min="0" value="0" />
        </div>
        <strong>x</strong>
        <div>
          <label>Time 2</label>
          <input class="pgr-score" data-pgr-team2 type="number" min="0" value="0" />
        </div>
      </div>

      <div class="pgr-label-row">
        <span>Melhor jogador</span>
        <small>opcional</small>
      </div>
      <div class="pgr-players" data-pgr-players></div>

      <textarea class="pgr-note" data-pgr-note maxlength="280" placeholder="Observação opcional: atraso, WO, divergência, etc."></textarea>

      <div class="pgr-actions">
        <button class="pgr-primary" type="button" data-pgr-submit>Enviar resultado</button>
        <button class="pgr-secondary" type="button" data-pgr-cancel>Depois</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.pgr-close')?.addEventListener('click', () => hidePostgameResultModal());
  modal.querySelector('[data-pgr-cancel]')?.addEventListener('click', () => hidePostgameResultModal());
  return modal;
}

export function showPostgameResultModal({ match, onSubmit } = {}) {
  const modal = ensurePostgameResultModal();
  const sport = match?.sport?.name || 'Partida';
  const arena = match?.arena?.name || 'Arena Zerø';
  modal.querySelector('[data-pgr-subtitle]').textContent = `${sport} em ${arena}: o XP só libera após consenso ou validação da arena.`;
  modal.querySelector('[data-pgr-phone]').value = '';
  modal.querySelector('[data-pgr-team1]').value = '0';
  modal.querySelector('[data-pgr-team2]').value = '0';
  modal.querySelector('[data-pgr-note]').value = '';

  let selectedBestPlayerId = '';
  const playersWrap = modal.querySelector('[data-pgr-players]');
  const activePlayers = (match?.players || []).filter((player) => player.team === 'team1' || player.team === 'team2');
  playersWrap.innerHTML = activePlayers.length ? '' : '<div class="pgr-empty">Sem jogadores titulares para selecionar.</div>';
  activePlayers.forEach((player) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pgr-player ${player.team === 'team1' ? 'team1' : 'team2'}`;
    button.dataset.playerId = player.playerId;
    button.innerHTML = `<b>${initials(player.name)}</b><span>${player.name}</span><em>${player.team === 'team1' ? 'T1' : 'T2'}</em>`;
    button.addEventListener('click', () => {
      selectedBestPlayerId = selectedBestPlayerId === player.playerId ? '' : player.playerId;
      playersWrap.querySelectorAll('.pgr-player').forEach((item) => item.classList.toggle('selected', item.dataset.playerId === selectedBestPlayerId));
    });
    playersWrap.appendChild(button);
  });

  modal.querySelector('[data-pgr-submit]').onclick = () => {
    const payload = {
      phone: modal.querySelector('[data-pgr-phone]').value,
      team1Score: modal.querySelector('[data-pgr-team1]').value,
      team2Score: modal.querySelector('[data-pgr-team2]').value,
      bestPlayerId: selectedBestPlayerId || null,
      note: modal.querySelector('[data-pgr-note]').value,
      played: true,
    };
    if (typeof onSubmit === 'function') onSubmit(payload);
  };

  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('visible'));
  return modal;
}

export function hidePostgameResultModal() {
  const modal = document.getElementById('postgame-result-modal');
  if (!modal) return;
  modal.classList.remove('visible');
  window.setTimeout(() => modal.classList.add('hidden'), 180);
}

function initials(name = '') {
  return String(name || 'P')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'P';
}
