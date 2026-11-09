import fs from 'node:fs';
import { canonicalModelName } from '../shared/catalog';

type DatabaseSyncConstructor = new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;

export interface SqliteStatement {
  all: (...params: unknown[]) => any[];
  get: (...params: unknown[]) => any;
}

export interface SqliteDatabase {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

let DatabaseSyncCtor: DatabaseSyncConstructor | null = null;
try {
  const sqliteMod = (await import('node:sqlite').catch(() => null)) as {
    DatabaseSync?: DatabaseSyncConstructor;
  } | null;
  if (sqliteMod && typeof sqliteMod.DatabaseSync === 'function') {
    DatabaseSyncCtor = sqliteMod.DatabaseSync;
  }
} catch {
  DatabaseSyncCtor = null;
}

export function hasSqlite(): boolean {
  return DatabaseSyncCtor !== null;
}

export function openDb(filePath: string): SqliteDatabase | null {
  if (!DatabaseSyncCtor) return null;
  try {
    const db = new DatabaseSyncCtor(filePath, { readOnly: true });
    // Verify readability against SQLite WAL locks
    db.prepare('PRAGMA schema_version').all();
    return db;
  } catch {
    try {
      return new DatabaseSyncCtor(filePath);
    } catch {
      return null;
    }
  }
}

export function getDbSignature(dbPath: string): string | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const st = fs.statSync(dbPath);
    let walSig = '0:0';
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      const wst = fs.statSync(walPath);
      walSig = `${wst.mtimeMs}:${wst.size}`;
    }
    return `${st.mtimeMs}:${st.size}|${walSig}`;
  } catch {
    return null;
  }
}

export function readVarintBigInt(buf: Uint8Array, startPos: number): { value: bigint; nextPos: number } | null {
  let pos = startPos;
  let value = 0n;
  let shift = 0n;
  while (pos < buf.length && shift <= 63n) {
    const byte = buf[pos++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value, nextPos: pos };
    }
    shift += 7n;
  }
  return null;
}

export type ProtoValue = number | Buffer;

/**
 * 解析 Protobuf 二进制消息（使用 BigInt 解析 varint，避免 JS 32 位位运算溢出）
 */
export function parseProto(buf: Buffer | Uint8Array | null | undefined): Map<number, ProtoValue> {
  const out = new Map<number, ProtoValue>();
  if (!buf || buf.length === 0) return out;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  let pos = 0;

  while (pos < b.length) {
    const tagRes = readVarintBigInt(b, pos);
    if (!tagRes) break;
    pos = tagRes.nextPos;

    const wireType = Number(tagRes.value & 7n);
    const fieldNum = Number(tagRes.value >> 3n);
    if (fieldNum <= 0 || fieldNum > 10000) break;

    if (wireType === 0) {
      const valRes = readVarintBigInt(b, pos);
      if (!valRes) break;
      pos = valRes.nextPos;
      out.set(fieldNum, Number(valRes.value));
    } else if (wireType === 2) {
      const lenRes = readVarintBigInt(b, pos);
      if (!lenRes) break;
      pos = lenRes.nextPos;
      const len = Number(lenRes.value);
      if (!Number.isSafeInteger(len) || len < 0 || pos + len > b.length) break;
      out.set(fieldNum, b.subarray(pos, pos + len));
      pos += len;
    } else if (wireType === 1) {
      if (pos + 8 > b.length) break;
      out.set(fieldNum, b.subarray(pos, pos + 8));
      pos += 8;
    } else if (wireType === 5) {
      if (pos + 4 > b.length) break;
      out.set(fieldNum, b.subarray(pos, pos + 4));
      pos += 4;
    } else {
      break;
    }
  }

  return out;
}

function getProtoBytes(map: Map<number, ProtoValue>, fieldNum: number): Buffer | null {
  const val = map.get(fieldNum);
  return Buffer.isBuffer(val) ? val : null;
}

function getProtoNum(map: Map<number, ProtoValue>, fieldNum: number, fallback = 0): number {
  const val = map.get(fieldNum);
  return typeof val === 'number' ? val : fallback;
}

export function extractStepIdx(field2: ProtoValue | undefined): number | null {
  if (!Buffer.isBuffer(field2) || field2.length === 0) return null;
  const res = readVarintBigInt(field2, 0);
  return res ? Number(res.value) : null;
}

export function extractTimestampFromStepMeta(buf: Uint8Array | Buffer | null | undefined): number | null {
  if (!buf || buf.length === 0) return null;
  try {
    const sMap = parseProto(buf);
    const sub = getProtoBytes(sMap, 1);
    if (sub && sub.length > 0) {
      const tMap = parseProto(sub);
      const sec = getProtoNum(tMap, 1, 0);
      if (sec > 1_000_000_000) return sec;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractToolInfo(payloadBuf: Uint8Array | Buffer | null | undefined): string | null {
  if (!payloadBuf || payloadBuf.length === 0) return null;
  try {
    const top = parseProto(payloadBuf);
    const f5 = getProtoBytes(top, 5);
    if (!f5) return null;
    const f5Map = parseProto(f5);
    const f4 = getProtoBytes(f5Map, 4);
    if (!f4) return null;
    const f4Map = parseProto(f4);
    const nameBuf = getProtoBytes(f4Map, 2);
    return nameBuf ? nameBuf.toString('utf8').trim() : null;
  } catch {
    return null;
  }
}

export interface ParsedGenMetadataStep {
  inTok: number;
  outTok: number;
  cacheRead: number;
  thinkTok: number;
  respTok: number;
  ctx: number;
  ttftSec: number;
  streamSec: number;
  totDur: number;
  rawModelId: string;
  modelName: string;
  stepIdx: number | null;
}

export function extractGenMetadataStep(rowData: Buffer | Uint8Array): ParsedGenMetadataStep {
  const top = parseProto(rowData);
  const chatBuf = getProtoBytes(top, 1);
  const chat = chatBuf ? parseProto(chatBuf) : new Map<number, ProtoValue>();

  const usageBuf = getProtoBytes(chat, 4);
  const usage = usageBuf ? parseProto(usageBuf) : new Map<number, ProtoValue>();
  const ttftBuf = getProtoBytes(chat, 11);
  const ttftMap = ttftBuf ? parseProto(ttftBuf) : new Map<number, ProtoValue>();
  const streamBuf = getProtoBytes(chat, 12);
  const streamMap = streamBuf ? parseProto(streamBuf) : new Map<number, ProtoValue>();

  const rawModelIdBuf = getProtoBytes(chat, 19);
  const rawModelNameBuf = getProtoBytes(chat, 21);
  const rawModelId = rawModelIdBuf ? rawModelIdBuf.toString('utf8').trim() : 'unknown';
  const rawModelName = rawModelNameBuf ? rawModelNameBuf.toString('utf8').trim() : '';

  const inTok = getProtoNum(usage, 2);
  const outTok = getProtoNum(usage, 3);
  const cacheRead = getProtoNum(usage, 5);
  const thinkTok = getProtoNum(usage, 9);
  const respTok = getProtoNum(usage, 10);

  const ttftSec = getProtoNum(ttftMap, 1) + getProtoNum(ttftMap, 2) / 1e9;
  const streamSec = getProtoNum(streamMap, 1) + getProtoNum(streamMap, 2) / 1e9;

  return {
    inTok,
    outTok,
    cacheRead,
    thinkTok,
    respTok,
    ctx: inTok + cacheRead,
    ttftSec,
    streamSec,
    totDur: ttftSec + streamSec,
    rawModelId,
    modelName: canonicalModelName(rawModelId, rawModelName),
    stepIdx: extractStepIdx(top.get(2))
  };
}
