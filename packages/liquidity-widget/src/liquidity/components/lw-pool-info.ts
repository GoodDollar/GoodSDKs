import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { POOL_ADDRESS, POOL_FEE } from '../constants';

import './lw-tooltip';

@customElement('lw-pool-info')
export class LwPoolInfo extends LitElement {
  static styles = css`
    :host { display: block; margin-bottom: 16px; }

    .pool-info {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      display: flex;
      align-items: center;
    }

    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }

    .pool-link {
      font-size: 12px;
      color: var(--lw-primary, #00b0ff);
      text-decoration: none;
      font-weight: 500;
    }
    .pool-link:hover { text-decoration: underline; }
  `;

  @property({ type: Number })
  gdPrice: number = 0;

  @property({ type: Boolean })
  loading: boolean = false;

  @property({ type: String })
  explorerUrl: string = 'https://celoscan.io';

  render() {
    const feeTier = `${POOL_FEE / 10_000}%`;
    const priceDisplay = this.loading
      ? 'Loading...'
      : this.gdPrice > 0
        ? `${(1000 * this.gdPrice).toFixed(4)} USDGLO`
        : '...';

    return html`
      <div class="pool-info">
        <div class="info-item">
          <span class="info-label">Pool
            <lw-tooltip style="text-transform: none;" text="This is the G$/USDGLO liquidity pool on Ubeswap V3 (Celo). You earn fees when people trade between these tokens."></lw-tooltip>
          </span>
          <span class="info-value">G$ / USDGLO</span>
        </div>
        <div class="info-item">
          <span class="info-label">Fee Tier</span>
          <span class="info-value">${feeTier}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Price (1,000 G$)</span>
          <span class="info-value">${priceDisplay}</span>
        </div>
        <div class="info-item">
          <a class="pool-link"
            href="${this.explorerUrl}/address/${POOL_ADDRESS}"
            target="_blank" rel="noopener noreferrer">
            View Pool &rarr;
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-pool-info': LwPoolInfo;
  }
}
