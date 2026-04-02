import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { formatEther } from 'viem';
import type { PositionData } from '../types';
import { IS_GD_TOKEN0 } from '../constants';

import './lw-position-card';
import './lw-tooltip';

@customElement('lw-positions-panel')
export class LwPositionsPanel extends LitElement {
  static styles = css`
    :host { display: block; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .header-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      display: flex;
      align-items: center;
    }

    .count-badge {
      font-size: 11px;
      font-weight: 600;
      background: var(--lw-primary, #00b0ff);
      color: white;
      border-radius: 10px;
      padding: 1px 7px;
      margin-left: 8px;
    }

    .summary {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
    .summary-value { font-size: 14px; font-weight: 600; color: #065f46; }

    .empty {
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
      padding: 24px 0;
    }

    .loading {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      padding: 24px 0;
    }
  `;

  @property({ type: Array })
  positions: PositionData[] = [];

  @property({ type: Boolean })
  loading: boolean = false;

  @property({ type: String })
  explorerUrl: string = 'https://celoscan.io';

  private _fmt(val: bigint): string {
    const n = Number(formatEther(val));
    if (n === 0) return '0';
    return Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(n);
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading positions...</div>`;
    }

    const totalGd = this.positions.reduce((sum, p) =>
      sum + (IS_GD_TOKEN0 ? p.amount0 : p.amount1), 0n);
    const totalUsdglo = this.positions.reduce((sum, p) =>
      sum + (IS_GD_TOKEN0 ? p.amount1 : p.amount0), 0n);
    const totalGdFees = this.positions.reduce((sum, p) =>
      sum + (IS_GD_TOKEN0 ? p.tokensOwed0 : p.tokensOwed1), 0n);
    const totalUsdgloFees = this.positions.reduce((sum, p) =>
      sum + (IS_GD_TOKEN0 ? p.tokensOwed1 : p.tokensOwed0), 0n);

    return html`
      <div class="header">
        <span class="header-title">
          My Positions
          <lw-tooltip text="Your liquidity positions in the G$/USDGLO pool. Each position earns trading fees proportional to your share of the pool."></lw-tooltip>
          ${this.positions.length > 0 ? html`<span class="count-badge">${this.positions.length}</span>` : ''}
        </span>
      </div>

      ${this.positions.length === 0 ? html`
        <div class="empty">No open positions in this pool.</div>
      ` : html`
        <div class="summary">
          <div class="summary-item">
            <span class="summary-label">Total G$</span>
            <span class="summary-value">${this._fmt(totalGd)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total USDGLO</span>
            <span class="summary-value">${this._fmt(totalUsdglo)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Unclaimed G$ Fees</span>
            <span class="summary-value">${this._fmt(totalGdFees)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Unclaimed USDGLO Fees</span>
            <span class="summary-value">${this._fmt(totalUsdgloFees)}</span>
          </div>
        </div>

        ${this.positions.map(p => html`
          <lw-position-card
            .position=${p}
            .explorerUrl=${this.explorerUrl}
          ></lw-position-card>
        `)}
      `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-positions-panel': LwPositionsPanel;
  }
}
