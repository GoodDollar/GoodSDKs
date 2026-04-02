import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TxFlowPhase } from '../types';

@customElement('lw-tx-status')
export class LwTxStatus extends LitElement {
  static styles = css`
    :host { display: block; margin-bottom: 12px; }

    .status-banner {
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .status-banner.info {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
    }
    .status-banner.success {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .status-banner.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }

    .status-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .status-body { flex: 1; }
    .status-body a {
      color: inherit;
      font-weight: 600;
      text-decoration: underline;
    }

    .retry-btn {
      margin-top: 8px;
      background: #991b1b;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .retry-btn:hover { background: #7f1d1d; }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #bfdbfe;
      border-top-color: #1e40af;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
      margin-top: 1px;
    }
  `;

  @property({ type: String })
  phase: TxFlowPhase = 'idle';

  @property({ type: String })
  txHash: string = '';

  @property({ type: String })
  errorMessage: string = '';

  @property({ type: String })
  explorerUrl: string = 'https://celoscan.io';

  render() {
    if (this.phase === 'idle') return html``;

    if (this.phase === 'error') {
      return html`
        <div class="status-banner error">
          <span class="status-icon">&#10007;</span>
          <div class="status-body">
            ${this.errorMessage || 'Transaction failed.'}
            <br/>
            <button class="retry-btn" @click=${this._retry}>Try Again</button>
          </div>
        </div>
      `;
    }

    if (this.phase === 'success') {
      return html`
        <div class="status-banner success">
          <span class="status-icon">&#10003;</span>
          <div class="status-body">
            Liquidity added successfully!
            ${this.txHash ? html`
              <br/><a href="${this.explorerUrl}/tx/${this.txHash}" target="_blank" rel="noopener noreferrer">View on Explorer</a>
            ` : ''}
          </div>
        </div>
      `;
    }

    const stepLabel = this.phase === 'approving-gd' ? 'Approving G$...'
      : this.phase === 'approving-usdglo' ? 'Approving USDGLO...'
      : 'Adding liquidity...';

    return html`
      <div class="status-banner info">
        <div class="spinner"></div>
        <div class="status-body">
          ${stepLabel}
          ${this.txHash ? html`
            <br/><a href="${this.explorerUrl}/tx/${this.txHash}" target="_blank" rel="noopener noreferrer">View transaction</a>
          ` : ''}
        </div>
      </div>
    `;
  }

  private _retry() {
    this.dispatchEvent(new CustomEvent('retry', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-tx-status': LwTxStatus;
  }
}
