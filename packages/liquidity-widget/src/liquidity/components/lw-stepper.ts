import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TxStepInfo } from '../types';

@customElement('lw-stepper')
export class LwStepper extends LitElement {
  static styles = css`
    :host { display: block; margin-bottom: 16px; }

    .stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      padding: 12px 0;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #9ca3af;
      white-space: nowrap;
    }

    .step.active { color: var(--lw-primary, #00b0ff); font-weight: 600; }
    .step.completed { color: #10b981; }
    .step.skipped { color: #d1d5db; text-decoration: line-through; }

    .step-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      border: 2px solid #e5e7eb;
      background: white;
      color: #9ca3af;
    }

    .step.active .step-circle {
      border-color: var(--lw-primary, #00b0ff);
      background: var(--lw-primary, #00b0ff);
      color: white;
    }

    .step.completed .step-circle {
      border-color: #10b981;
      background: #10b981;
      color: white;
    }

    .step.skipped .step-circle {
      border-color: #e5e7eb;
      background: #f3f4f6;
      color: #d1d5db;
    }

    .connector {
      width: 32px;
      height: 2px;
      background: #e5e7eb;
      margin: 0 4px;
      flex-shrink: 0;
    }

    .connector.done { background: #10b981; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .step.active .step-circle { animation: pulse 1.5s ease-in-out infinite; }
  `;

  @property({ type: Array })
  steps: TxStepInfo[] = [];

  render() {
    return html`
      <div class="stepper">
        ${this.steps.map((step, i) => html`
          ${i > 0 ? html`<div class="connector ${this._connectorDone(i) ? 'done' : ''}"></div>` : ''}
          <div class="step ${step.status}">
            <div class="step-circle">
              ${step.status === 'completed' ? html`&#10003;` :
                step.status === 'skipped' ? html`&mdash;` :
                html`${i + 1}`}
            </div>
            <span>${step.label}</span>
          </div>
        `)}
      </div>
    `;
  }

  private _connectorDone(index: number): boolean {
    const prev = this.steps[index - 1];
    return prev?.status === 'completed' || prev?.status === 'skipped';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-stepper': LwStepper;
  }
}
