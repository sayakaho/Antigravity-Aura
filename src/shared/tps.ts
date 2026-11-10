import type {
  SessionSpeedModelStat,
  SessionSpeedSlot,
  SessionSpeedTimeline,
  TimedSpeedSample
} from '../types';

export const CAPSULE_MIN_STREAM_SEC = 0.25;
export const CAPSULE_MAX_STREAM_TPS = 600;
export const SESSION_SPEED_BUCKET_SIZES = [30, 60, 120, 300, 900, 1800, 3600, 14400, 86400] as const;
export const SESSION_SPEED_MAX_SLOTS = 36;

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

/**
 * Align to local wall-clock bucket boundaries rather than dividing UTC epoch seconds,
 * so half-hour timezones and multi-hour/daily ticks still fall cleanly on :00 / midnight.
 */
export function alignLocalBucketStartSec(epochSec: number, bucketSizeSec: number): number {
  const d = new Date(epochSec * 1000);
  if (bucketSizeSec >= 86400) {
    return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000);
  }
  if (bucketSizeSec >= 3600) {
    const hours = Math.max(1, Math.floor(bucketSizeSec / 3600));
    const alignedHour = Math.floor(d.getHours() / hours) * hours;
    return Math.floor(
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), alignedHour, 0, 0).getTime() / 1000
    );
  }
  if (bucketSizeSec >= 60) {
    const mins = Math.max(1, Math.floor(bucketSizeSec / 60));
    const alignedMin = Math.floor(d.getMinutes() / mins) * mins;
    return Math.floor(
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), alignedMin, 0).getTime() /
        1000
    );
  }
  const stepSec = Math.max(1, Math.floor(bucketSizeSec));
  const alignedSec = Math.floor(d.getSeconds() / stepSec) * stepSec;
  return Math.floor(
    new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      d.getHours(),
      d.getMinutes(),
      alignedSec
    ).getTime() / 1000
  );
}

/**
 * Aggregate timed session samples into adaptive non-empty active buckets so overnight/multi-day
 * pauses fold cleanly without crushing active work bursts into coarse buckets.
 */
export function buildSessionSpeedTimeline(
  samples: TimedSpeedSample[]
): SessionSpeedTimeline | undefined {
  const valid: TimedSpeedSample[] = [];
  for (const s of samples || []) {
    const modelId = (s.modelId || '').trim();
    const modelName = (s.modelName || '').trim();
    if (
      !Number.isFinite(s.ts) ||
      s.ts <= 1_000_000_000 ||
      !Number.isFinite(s.effOutTok) ||
      s.effOutTok <= 0 ||
      !Number.isFinite(s.effSec) ||
      s.effSec <= 0 ||
      !modelId ||
      modelId.toLowerCase() === 'unknown' ||
      modelName.toLowerCase().includes('unknown')
    ) {
      continue;
    }
    valid.push({
      ts: s.ts,
      modelId,
      modelName: modelName || modelId,
      effOutTok: s.effOutTok,
      effSec: s.effSec
    });
  }

  if (valid.length === 0) return undefined;

  let chosenBucketSize: number = SESSION_SPEED_BUCKET_SIZES[SESSION_SPEED_BUCKET_SIZES.length - 1];
  for (const candidateSize of SESSION_SPEED_BUCKET_SIZES) {
    const distinctStarts = new Set<number>();
    for (const s of valid) {
      distinctStarts.add(alignLocalBucketStartSec(s.ts, candidateSize));
      if (distinctStarts.size > SESSION_SPEED_MAX_SLOTS) break;
    }
    if (distinctStarts.size <= SESSION_SPEED_MAX_SLOTS) {
      chosenBucketSize = candidateSize;
      break;
    }
  }

  const slotMap = new Map<number, Record<string, SessionSpeedModelStat>>();
  for (const s of valid) {
    const bucketStartSec = alignLocalBucketStartSec(s.ts, chosenBucketSize);
    let models = slotMap.get(bucketStartSec);
    if (!models) {
      models = {};
      slotMap.set(bucketStartSec, models);
    }
    const existing = models[s.modelId];
    if (!existing) {
      models[s.modelId] = {
        modelId: s.modelId,
        modelName: s.modelName,
        effOutTok: s.effOutTok,
        effSec: s.effSec,
        requests: 1
      };
    } else {
      existing.effOutTok += s.effOutTok;
      existing.effSec += s.effSec;
      existing.requests += 1;
    }
  }

  const slots: SessionSpeedSlot[] = Array.from(slotMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStartSec, models]) => ({ bucketStartSec, models }));

  return {
    bucketSizeSec: chosenBucketSize,
    slots
  };
}
