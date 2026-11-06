// App-owned single-choice controls, sharing the sheet's focus/Back behaviour.
import { html } from '../core/dom.js';
import { openSheet } from './sheet.js';
import { icons } from './icons.js';

export function choiceField({ label, value, field, context = '', id = '' }) {
  return html`<div class="field compact"><span>${label}</span>
    <button type="button" class="input choice-trigger"${id ? html` id="${id}"` : ''} data-choice="${field}" data-field="${field}" aria-label="${label}${context ? ' for ' + context : ''}: ${value}" aria-haspopup="dialog" aria-expanded="false">
      <span>${value}</span><span class="choice-chevron" aria-hidden="true">${icons.chevron}</span>
    </button></div>`;
}

export async function chooseOption({ trigger, title, subtitle = '', options, selected, layout = 'list' }) {
  if (trigger.getAttribute('aria-expanded') === 'true') return null;
  trigger.setAttribute('aria-expanded', 'true');
  try {
    return await openSheet({
      title, subtitle, className: 'choice-sheet', settleHistory: true,
      body: html`<div class="choice-options choice-${layout}" role="listbox" aria-label="${title}">
        ${options.map((option, i) => html`<button type="button" class="choice-option" role="option" aria-selected="${option.value === selected ? 'true' : 'false'}" data-choice-index="${i}" tabindex="${option.value === selected ? '0' : '-1'}"${option.value === selected ? html` autofocus` : ''}>
          <span class="choice-copy"><b>${option.label}</b>${option.description ? html`<small>${option.description}</small>` : ''}</span>
          <span class="choice-check" aria-hidden="true">${icons.check}</span>
        </button>`)}
      </div>`,
      onMount(sheet, close) {
        const buttons = [...sheet.querySelectorAll('[data-choice-index]')];
        const current = buttons.find(b => b.getAttribute('aria-selected') === 'true') || buttons[0];
        if (current) {
          current.tabIndex = 0;
          current.setAttribute('autofocus', '');
          requestAnimationFrame(() => current.scrollIntoView({ block: 'nearest' }));
        }
        buttons.forEach((button, i) => button.addEventListener('click', () => close(options[i].value)));
        // The app's shared listbox keyboard handler supplies arrows/Home/End;
        // options activate with Enter/Space, so navigating can be cancelled.
      },
    });
  } finally {
    trigger.setAttribute('aria-expanded', 'false');
  }
}
