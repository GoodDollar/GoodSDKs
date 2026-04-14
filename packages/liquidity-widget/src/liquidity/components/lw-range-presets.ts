import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { RangePreset } from '../types';
import {
  FULL_RANGE_TICK_LOWER, FULL_RANGE_TICK_UPPER,
  nearestUsableTick,
} from '@goodsdks/liquidity-sdk';

import './lw-tooltip';

export const RANGE_PRESETS: RangePreset[] = [
  {
    id: 'full',
    label: 'Full Range',
    description: 'Max flexibility, lower capital efficiency',
    tooltip: 'Covers the entire price range. Your liquidity is always active but spread thin, earning lower fees per dollar deposited.',
    concentrationMultiplier: 1,
    getTickRange: () => ({
      tickLower: FULL_RANGE_TICK_LOWER,
      tickUpper: FULL_RANGE_TICK_UPPER,
    }),
  },
  {
    id: 'wide',
    label: 'Wide',
    description: 'Balanced range around current price',
    tooltip: 'Concentrates liquidity in a wide band around the current price. Good balance of fee earnings and rebalancing frequency.',
    concentrationMultiplier: 4,
    getTickRange: (currentTick: number, tickSpacing: number) => ({
      tickLower: nearestUsableTick(currentTick - 120 * tickSpacing, tickSpacing),
      tickUpper: nearestUsableTick(currentTick + 120 * tickSpacing, tickSpacing),
    }),
  },
  {
    id: 'narrow',
    label: 'Narrow',
    description: 'Tight range, higher yield, more risk',
    tooltip: 'Concentrates liquidity tightly around the current price for maximum fee earnings. Higher impermanent loss risk and may go out of range if price moves significantly.',
    concentrationMultiplier: 10,
    getTickRange: (currentTick: number, tickSpacing: number) => ({
      tickLower: nearestUsableTick(currentTick - 30 * tickSpacing, tickSpacing),
      tickUpper: nearestUsableTick(currentTick + 30 * tickSpacing, tickSpacing),
    }),
  },
];

@customElement('lw-range-presets')
export class LwRangePresets extends LitElement {
  static styles = css`
    :host { display: block; margin-bottom: 16px; }

    .label {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }

    .presets {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .preset-card {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      padding: 10px 8px;
      cursor: pointer;
      text-align: center;
      transition: border-color 0.15s, background 0.15s;
    }
    .preset-card:hover { border-color: #d1d5db; }
    .preset-card.selected {
      border-color: var(--lw-primary, #00b0ff);
      background: rgba(0, 176, 255, 0.06);
    }

    .preset-name {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 2px;
    }

    .preset-desc {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.3;
      margin-bottom: 4px;
    }

    .preset-yield {
      font-size: 12px;
      font-weight: 600;
      color: #059669;
    }
  `;

  @property({ type: String })
  selected: 'full' | 'wide' | 'narrow' = 'full';

  @property({ type: Number })
  baseApr: number = 0;

  render() {
    return html`
      <div class="label">
        Range Strategy
        <lw-tooltip text="Choose how to concentrate your liquidity. Narrower ranges earn more fees when in range but need monitoring."></lw-tooltip>
      </div>
      <div class="presets">
        ${RANGE_PRESETS.map(preset => html`
          <div
            class="preset-card ${this.selected === preset.id ? 'selected' : ''}"
            @click=${() => this._select(preset.id)}
          >
            <div class="preset-name">${preset.label}</div>
            <div class="preset-desc">${preset.description}</div>
            ${this.baseApr > 0 ? html`
              <div class="preset-yield">~${(this.baseApr * preset.concentrationMultiplier).toFixed(1)}% APR</div>
            ` : ''}
          </div>
        `)}
      </div>
    `;
  }

  private _select(id: 'full' | 'wide' | 'narrow') {
    this.selected = id;
    this.dispatchEvent(new CustomEvent('range-change', {
      detail: { id },
      bubbles: true, composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-range-presets': LwRangePresets;
  }
}
