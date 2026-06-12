export function ensurePlayerEvolutionLayer() {
  let layer = document.getElementById('player-evolution-layer');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.id = 'player-evolution-layer';
  layer.className = 'player-evolution-layer hidden';
  layer.innerHTML = `
    <div class="pel-card">
      <button class="pel-close" type="button" aria-label="Fechar">×</button>
      <div class="pel-kicker" data-pel-kicker>ARENA ZERØ</div>
      <h3 data-pel-title>XP pendente</h3>
      <p data-pel-body>Confirme o resultado para liberar sua recompensa.</p>
      <div class="pel-progress-wrap">
        <div class="pel-progress-label"><span data-pel-progress-label>Progresso</span><b data-pel-progress-value>0%</b></div>
        <div class="pel-progress"><i data-pel-progress-bar></i></div>
      </div>
      <div class="pel-badges" data-pel-badges></div>
      <div class="pel-actions">
        <button class="pel-primary" type="button" data-pel-primary>Confirmar resultado</button>
        <button class="pel-secondary" type="button" data-pel-secondary>Agora não</button>
      </div>
    </div>
  `;
  document.body.appendChild(layer);
  layer.querySelector('.pel-close')?.addEventListener('click', () => hidePlayerEvolutionLayer());
  layer.querySelector('[data-pel-secondary]')?.addEventListener('click', () => hidePlayerEvolutionLayer());
  return layer;
}

export function showPlayerEvolutionLayer(options = {}) {
  const layer = ensurePlayerEvolutionLayer();
  const progress = Math.max(0, Math.min(Number(options.progressPercent || 0), 100));

  layer.querySelector('[data-pel-kicker]').textContent = options.kicker || 'ARENA ZERØ';
  layer.querySelector('[data-pel-title]').textContent = options.title || 'XP pendente';
  layer.querySelector('[data-pel-body]').textContent = options.body || 'Confirme o resultado para liberar sua recompensa.';
  layer.querySelector('[data-pel-progress-label]').textContent = options.progressLabel || 'Progresso até próximo nível';
  layer.querySelector('[data-pel-progress-value]').textContent = `${Math.round(progress)}%`;
  layer.querySelector('[data-pel-progress-bar]').style.width = `${progress}%`;

  const badges = layer.querySelector('[data-pel-badges]');
  badges.innerHTML = '';
  (options.badges || []).forEach((badge) => {
    const item = document.createElement('span');
    item.textContent = badge;
    badges.appendChild(item);
  });

  const primary = layer.querySelector('[data-pel-primary]');
  primary.textContent = options.primaryLabel || 'Confirmar resultado';
  primary.onclick = typeof options.onPrimary === 'function' ? options.onPrimary : null;

  layer.classList.remove('hidden');
  requestAnimationFrame(() => layer.classList.add('visible'));
  return layer;
}

export function showPendingXpLayer({ match, onConfirm } = {}) {
  const sport = match?.sport?.name || 'Partida';
  const arena = match?.arena?.name || 'Arena Zerø';
  return showPlayerEvolutionLayer({
    kicker: 'XP PENDENTE',
    title: 'Confirme o resultado',
    body: `${sport} em ${arena}: confirme o placar para liberar seu XP e atualizar o ranking.`,
    progressLabel: 'XP travado até confirmação',
    progressPercent: 65,
    badges: ['pós-jogo', 'ranking', 'XP'],
    primaryLabel: 'Confirmar placar',
    onPrimary: onConfirm,
  });
}

export function showXpAppliedLayer({ xpEarned = 0, mmrDelta = 0, badges = [], levelTitle = '', onPrimary } = {}) {
  const mmrText = mmrDelta > 0 ? ` · MMR +${mmrDelta}` : mmrDelta < 0 ? ` · MMR ${mmrDelta}` : '';
  return showPlayerEvolutionLayer({
    kicker: 'EVOLUÇÃO DO PLAYER',
    title: `+${xpEarned} XP aplicado`,
    body: `${levelTitle ? `${levelTitle} · ` : ''}Ranking atualizado${mmrText}.`,
    progressLabel: 'Caminho até próximo nível',
    progressPercent: 80,
    badges,
    primaryLabel: 'Ver ranking',
    onPrimary,
  });
}

export function hidePlayerEvolutionLayer() {
  const layer = document.getElementById('player-evolution-layer');
  if (!layer) return;
  layer.classList.remove('visible');
  window.setTimeout(() => layer.classList.add('hidden'), 180);
}
