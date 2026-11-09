export const CAPSULE_MIN_STREAM_SEC = 0.25;
export const CAPSULE_MAX_STREAM_TPS = 600;

export interface StepTpsResult {
  streamTps: number;
  e2eTps: number;
  displayTps: number;
  usedStream: boolean;
  effectiveSec: number;
  totDur: number;
}

export interface BucketTpsInput {
  effOutTok?: number;
  effSec?: number;
  outTok?: number;
  ttftSec?: number;
  streamSec?: number;
}

/**
 * 与遥测胶囊完全一致的单步 TPS 计算规则：
 * - 纯流式：stream >= 0.25s 时为 outTok / stream，否则为 0
 * - 端到端：totDur > 0 时为 outTok / totDur，否则为 0
 * - 主口径：流式处于 (0, 600] 物理区间内优先取流式，否则自动回退端到端
 * - effectiveSec 记录参与速度计算的分母，供多步桶做 token 加权汇总时消除短突发脉冲失真
 */
export function computeStepTps(
  outTok = 0,
  ttft = 0,
  stream = 0,
  totDurInput = 0
): StepTpsResult {
  const out = Math.max(0, Number(outTok) || 0);
  const t = Math.max(0, Number(ttft) || 0);
  const s = Math.max(0, Number(stream) || 0);
  const totDur = totDurInput > 0 ? Number(totDurInput) : t + s;

  const streamTps = s >= CAPSULE_MIN_STREAM_SEC && out > 0 ? out / s : 0;
  const e2eTps = totDur > 0 && out > 0 ? out / totDur : 0;
  const usedStream = streamTps > 0 && streamTps <= CAPSULE_MAX_STREAM_TPS;
  const displayTps = usedStream ? streamTps : e2eTps;
  const effectiveSec = out > 0 && displayTps > 0 ? (usedStream ? s : totDur) : 0;

  return {
    streamTps,
    e2eTps,
    displayTps,
    usedStream,
    effectiveSec,
    totDur
  };
}

export function computeWeightedTps(effOutTok = 0, effSec = 0): number {
  const out = Number(effOutTok) || 0;
  const sec = Number(effSec) || 0;
  return sec > 0 && out > 0 ? Math.round(out / sec) : 0;
}

export function computeBucketTps(bucket?: BucketTpsInput | null): number {
  if (!bucket) return 0;
  if ((bucket.effSec || 0) > 0 && (bucket.effOutTok || 0) > 0) {
    return Math.round(bucket.effOutTok! / bucket.effSec!);
  }
  return Math.round(computeStepTps(bucket.outTok, bucket.ttftSec, bucket.streamSec).displayTps);
}
