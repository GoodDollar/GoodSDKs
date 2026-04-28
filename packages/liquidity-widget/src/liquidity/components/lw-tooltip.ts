import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('lw-tooltip')
export class LwTooltip extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
      vertical-align: middle;
    }

    .trigger {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #e5e7eb;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      border: none;
      padding: 0;
      margin-left: 4px;
      transition: background 0.15s;
    }
    .trigger:hover { background: #d1d5db; }

    .popover {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      color: #f9fafb;
      font-size: 12px;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: 8px;
      width: max-content;
      max-width: 260px;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .popover.visible {
      opacity: 1;
      pointer-events: auto;
    }

    .popover::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: #1f2937;
    }
  `;

  @property({ type: String })
  text = '';

  @state()
  private _visible = false;

  render() {
    return html`
      <button
        class="trigger"
        @mouseenter=${this._show}
        @mouseleave=${this._hide}
        @click=${this._toggle}
        aria-label="More info"
      >?</button>
      <div class="popover ${this._visible ? 'visible' : ''}">${this.text}</div>
    `;
  }

  private _show() { this._visible = true; }
  private _hide() { this._visible = false; }
  private _toggle() { this._visible = !this._visible; }
}

declare global {
  interface HTMLElementTagNameMap {
    'lw-tooltip': LwTooltip;
  }
}
