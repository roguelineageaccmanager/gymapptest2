// Small SVG line chart for lift and body-weight history.
import { html, raw } from '../core/dom.js';
import { parseYmd, fmtShort } from '../core/dates.js';

/** points: [{ date: 'YYYY-MM-DD', w: number }], oldest first. */
export function lineChart(points, { unit = 'kg', best = null, label = 'History' } = {}) {
  if (!points.length) return '';
  const W = 320, H = 156, L = 40, R = 14, T = 44, B = 24;
  const ws = points.map((p) => p.w);
  let min = Math.min(...ws), max = Math.max(...ws);
  if (min === max) { min -= 2; max += 2; }
  const pad = (max - min) * 0.2;
  min = Math.max(0, min - pad); max += pad;
  const ts = points.map((p) => parseYmd(p.date).getTime());
  const t0 = ts[0], span = (ts[ts.length - 1] - t0) || 1;
  const X = (t) => (points.length === 1 ? L + (W - L - R) / 2 : L + ((t - t0) / span) * (W - L - R));
  const Y = (w) => T + (1 - (w - min) / (max - min)) * (H - T - B);
  const f = (n) => n.toFixed(1);
  let grid = '';
  for (let i = 0; i < 3; i++) {
    const v = min + ((max - min) * i) / 2, y = Y(v);
    grid += `<line class="g-grid" x1="${L}" x2="${W - R}" y1="${f(y)}" y2="${f(y)}"/><text class="g-tick" x="${L - 6}" y="${f(y + 3)}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  const line = points.map((p, i) => f(X(ts[i])) + ',' + f(Y(p.w))).join(' ');
  const area = `${f(X(ts[0]))},${H - B} ${line} ${f(X(ts[ts.length - 1]))},${H - B}`;
  const dots = points.map((p, i) => {
    const x = f(X(ts[i])), y = f(Y(p.w));
    return `<circle class="g-hit" cx="${x}" cy="${y}" r="12" data-chart-point data-date="${p.date}" data-value="${p.w}" data-unit="${unit}" tabindex="0" role="button" aria-label="${fmtShort(p.date)}: ${p.w} ${unit}"/><circle class="g-dot" cx="${x}" cy="${y}" r="2.6"/>`;
  }).join('');
  const last = points.length - 1, sx = X(ts[last]), sy = Y(ws[last]);
  const bx = Math.max(L, Math.min(sx - 59, W - R - 118)), by = Math.max(2, sy - 46);
  let ring = '';
  const bi = best == null ? -1 : ws.lastIndexOf(best);
  if (bi >= 0) ring = `<circle class="g-best" cx="${f(X(ts[bi]))}" cy="${f(Y(ws[bi]))}" r="6"/>`;
  const selection = `<g data-chart-selection aria-hidden="true"><rect class="g-select-bg" x="${f(bx)}" y="${f(by)}" width="118" height="34" rx="8"/><text class="g-select-date" x="${f(bx + 59)}" y="${f(by + 13)}" text-anchor="middle">${fmtShort(points[last].date)}</text><text class="g-select-value" x="${f(bx + 59)}" y="${f(by + 27)}" text-anchor="middle">${ws[last]} ${unit}</text><circle class="g-selected" cx="${f(sx)}" cy="${f(sy)}" r="7"/></g>`;
  const labels = `<text class="g-tick" x="${L}" y="${H - 6}">${fmtShort(points[0].date)}</text>` +
    (points.length > 1 ? `<text class="g-tick" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(points[last].date)}</text>` : '');
  return html`<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="${label}">${raw(grid)}<polygon class="g-area" points="${area}"/><polyline class="g-line" points="${line}"/>${raw(dots + ring + selection + labels)}</svg><output class="sr-only" data-chart-selection-output aria-live="polite">${fmtShort(points[last].date)} · ${ws[last]} ${unit}</output></div>`;
}
