const STYLE_ID = 'arena-postgame-review-style';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .arena-postgame-review-panel {
      margin: 16px 0;
      border-radius: 24px;
      padding: 16px;
      background: linear-gradient(145deg, rgba(15,15,19,.96), rgba(26,31,24,.94));
      border: 1px solid rgba(160,255,91,.22);
      box-shadow: 0 18px 50px rgba(0,0,0,.36), 0 0 28px rgba(160,255,91,.1);
    }

    .arena-postgame-review-panel.hidden {
      display: none;
    }

    .apgr-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .apgr-head span {
      display: block;
      color: var(--green);
      font-size: .72rem;
      font-weight: 900;
      letter-spacing: .18em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .apgr-head h3 {
      margin: 0;
      font-size: 1.18rem;
      line-height: 1.1;
    }

    .apgr-head button,
    .apgr-actions button {
      border: 0;
      border-radius: 14px;
      padding: 10px 12px;
      font-weight: 900;
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.78);
    }

    .apgr-list {
      display: grid;
      gap: 10px;
    }

    .apgr-card {
      border-radius: 18px;
      padding: 13px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12);
    }

    .apgr-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .apgr-card-top strong {
      font-size: .98rem;
      line-height: 1.25;
    }

    .apgr-card-top span {
      flex: 0 0 auto;
      border-radius: 999px;
      padding: 5px 8px;
      font-size: .68rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
      background: rgba(160,255,91,.13);
      color: var(--green);
      border: 1px solid rgba(160,255,91,.2);
    }

    .apgr-card-top span.danger {
      background: rgba(255,120,120,.12);
      color: #ff9b9b;
      border-color: rgba(255,120,120,.22);
    }

    .apgr-card p {
      margin: 8px 0 12px;
      color: rgba(255,255,255,.62);
      line-height: 1.35;
    }

    .apgr-card p b {
      color: #fff;
    }

    .apgr-actions {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 8px;
    }

    .apgr-actions button:first-child {
      background: linear-gradient(135deg, var(--green), var(--cyan));
      color: #06120a;
    }

    .apgr-actions button:disabled {
      opacity: .45;
      filter: grayscale(1);
    }

    @media(max-width:560px) {
      .apgr-head,
      .apgr-card-top {
        display: grid;
      }
      .apgr-actions {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}
