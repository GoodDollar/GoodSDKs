import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { formatEther } from 'viem';
import type { PositionData } from '@goodsdks/liquidity-sdk';
import { IS_GD_TOKEN0 } from '@goodsdks/liquidity-sdk';

const UBESWAP_POOL_BASE = 'https://app.ubeswap.org/#/pools';

@customElement('lw-position-card')
export class LwPositionCard extends LitElement {
  static styles = css`
    :host { display: block; }

    .card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 10px;
      transition: border-color 0.15s;
    }
    .card:hover { border-color: #d1d5db; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .token-id {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .range-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .range-badge.in-range { background: #d1fae5; color: #065f46; }
    .range-badge.out-of-range { background: #fef3c7; color: #92400e; }

    .amounts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }

    .amount-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .amount-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .amount-value {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }

    .fees-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
    }
    .fees-label {
      font-size: 12px;
      color: #6b7280;
    }
    .fees-value {
      font-size: 13px;
      font-weight: 600;
      color: #059669;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }

    .manage-link {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
      background: var(--lw-primary, #00b0ff);
      color: white;
    }
    .manage-link:hover { filter: brightness(0.92); }
    .manage-link .arrow { margin-left: 6px; font-size: 14px; }
  `;

  @property({ type: Object })
  position!: PositionData;

  @property({ type: String })
  explorerUrl: string = 'https://celoscan.io';

  private _fmt(val: bigint): string {
    if (val === 0n) return '0';
    const num = Number(formatEther(val));
    if (num < 0.0001) return '<0.0001';
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  }

  render() {
    const p = this.position;
    if (!p) return html``;

    const gdAmount = IS_GD_TOKEN0 ? p.amount0 : p.amount1;
    const usdgloAmount = IS_GD_TOKEN0 ? p.amount1 : p.amount0;
    const gdFees = IS_GD_TOKEN0 ? p.tokensOwed0 : p.tokensOwed1;
    const usdgloFees = IS_GD_TOKEN0 ? p.tokensOwed1 : p.tokensOwed0;
    const manageUrl = `${UBESWAP_POOL_BASE}/${p.tokenId.toString()}`;

    return html`
      <div class="card">
        <div class="card-header">
          <span class="token-id">Position #${p.tokenId.toString()}</span>
          <span class="range-badge ${p.inRange ? 'in-range' : 'out-of-range'}">
            ${p.inRange ? 'In Range' : 'Out of Range'}
          </span>
        </div>

        <div class="amounts">
          <div class="amount-item">
            <span class="amount-label">G$</span>
            <span class="amount-value">${this._fmt(gdAmount)}</span>
          </div>
          <div class="amount-item">
            <span class="amount-label">USDGLO</span>
            <span class="amount-value">${this._fmt(usdgloAmount)}</span>
          </div>
        </div>

        <div class="fees-row">
          <span class="fees-label">Unclaimed Fees</span>
          <span class="fees-value">
            ${this._fmt(gdFees)} G$ / ${this._fmt(usdgloFees)} USDGLO
          </span>
        </div>

        <div class="actions">
          <a class="manage-link"
            href="${manageUrl}"
            target="_blank"
            rel="noopener noreferrer">
            Manage<span class="arrow">&rarr;</span>
          </a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-position-card': LwPositionCard;
  }
}
