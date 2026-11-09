import { escapeHtml, formatCompactNumber } from '../../shared/format';

export interface ChartColumnData {
  label: string;
  tooltipHeader: string;
  inputTok: number;
  outTok: number;
  cacheRead: number;
  ctx?: number;
  requests: number;
  subText?: string;
}

export function computeNiceYScale(
  rawMax: number,
  minBaseline = 1000,
  segments = 4
): { yMax: number; yTicks: number[] } {
  const safeMax = Math.max(Number(rawMax) || 0, minBaseline);
  const magnitude = Math.pow(10, Math.floor(Math.log10(safeMax)));
  const normalized = safeMax / magnitude;

  let tickStep = magnitude;
  if (normalized <= 2) tickStep = 0.5 * magnitude;
  else if (normalized <= 5) tickStep = 1 * magnitude;
  else tickStep = 2 * magnitude;

  const stepBlock = tickStep * segments;
  const yMax = Math.ceil(safeMax / stepBlock) * stepBlock || stepBlock;
  const yTicks: number[] = [];
  for (let i = 0; i <= segments; i++) {
    yTicks.push((yMax * i) / segments);
  }
  return { yMax, yTicks };
}

export function computePercentile(arr: number[], p: number): number {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function buildYAxisGridSvg(opts: {
  yTicks: number[];
  yMax: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  svgWidth: number;
  chartHeight: number;
  unitSuffix?: string;
  axisOpacityZero?: string;
  axisOpacityGrid?: string;
}): { linesSvg: string; textsSvg: string } {
  let linesSvg = '';
  let textsSvg = '';
  const suffix = opts.unitSuffix || '';
  const zeroOp = opts.axisOpacityZero ?? '0.6';
  const gridOp = opts.axisOpacityGrid ?? '0.25';

  for (const tickVal of opts.yTicks) {
    const y = opts.paddingTop + opts.chartHeight - (tickVal / opts.yMax) * opts.chartHeight;
    linesSvg += `<line x1="${opts.paddingLeft}" y1="${y.toFixed(1)}" x2="${opts.svgWidth - opts.paddingRight}" y2="${y.toFixed(1)}" stroke="var(--aura-border)" stroke-width="1" stroke-dasharray="3 3" opacity="${tickVal === 0 ? zeroOp : gridOp}" />`;
    const labelText = suffix ? `${Math.round(tickVal)}${suffix}` : formatCompactNumber(tickVal);
    textsSvg += `<text x="${opts.paddingLeft - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="10" font-family="var(--aura-font-mono)" fill="var(--aura-fg-muted)">${escapeHtml(labelText)}</text>`;
  }

  return { linesSvg, textsSvg };
}

export function renderEmptyChartCard(
  chartWrapper: HTMLElement,
  title: string,
  emptyMsg: string,
  subtitle?: string
): void {
  const subtitleHtml = subtitle
    ? `<span class="chart-subtitle">${escapeHtml(subtitle)}</span>`
    : '';
  chartWrapper.innerHTML = `
    <div class="chart-header">
      <div class="chart-header-left">
        <h3 class="chart-title">${escapeHtml(title)}${subtitleHtml}</h3>
      </div>
    </div>
    <div class="chart-empty">${escapeHtml(emptyMsg)}</div>
  `;
}

export function positionTooltipNearAnchor(opts: {
  tooltip: HTMLElement;
  stageWidth: number;
  stageHeight: number;
  viewLeft?: number;
  anchorLeft: number;
  anchorRight: number;
  preferredTop?: number;
  minWidthFallback?: number;
  minHeightFallback?: number;
}): void {
  const {
    tooltip,
    stageWidth,
    stageHeight,
    viewLeft = 0,
    anchorLeft,
    anchorRight,
    preferredTop = 10,
    minWidthFallback = 180,
    minHeightFallback = 135
  } = opts;

  const tipWidth = tooltip.offsetWidth || minWidthFallback;
  const tipHeight = tooltip.offsetHeight || minHeightFallback;
  const viewRight = viewLeft + stageWidth;

  const spaceRight = viewRight - (anchorRight + 12);
  const spaceLeft = anchorLeft - 12 - viewLeft;

  let left = 0;
  if (spaceRight >= tipWidth + 6 && (spaceRight >= spaceLeft || spaceLeft < tipWidth)) {
    left = anchorRight + 12;
  } else if (spaceLeft >= tipWidth + 6) {
    left = anchorLeft - tipWidth - 12;
  } else if (spaceRight >= spaceLeft) {
    left = Math.max(anchorRight + 4, viewRight - tipWidth - 6);
  } else {
    left = Math.min(anchorLeft - tipWidth - 4, viewLeft + 6);
  }

  left = Math.max(viewLeft + 6, Math.min(left, viewRight - tipWidth - 6));

  let top = preferredTop;
  const maxSafeTop = stageHeight - tipHeight - 12;
  if (maxSafeTop > 10) {
    top = Math.min(top, maxSafeTop);
  }
  top = Math.max(6, top);

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}
