import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractGenMetadataStep,
  extractTimestampFromStepMeta,
  extractToolInfo,
  getDbSignature,
  parseProto,
  readVarintBigInt
} from '../src/server/sqlite-proto';

function encodeVarint(val: number | bigint): Buffer {
  let n = BigInt(val);
  const bytes: number[] = [];
  while (n >= 0x80n) {
    bytes.push(Number((n & 0x7fn) | 0x80n));
    n >>= 7n;
  }
  bytes.push(Number(n));
  return Buffer.from(bytes);
}

function encodeFieldVarint(fieldNum: number, val: number | bigint): Buffer {
  return Buffer.concat([encodeVarint((fieldNum << 3) | 0), encodeVarint(val)]);
}

function encodeFieldBytes(fieldNum: number, payload: Buffer | string): Buffer {
  const buf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : payload;
  return Buffer.concat([encodeVarint((fieldNum << 3) | 2), encodeVarint(buf.length), buf]);
}

function encodeFieldFixed64(fieldNum: number): Buffer {
  return Buffer.concat([encodeVarint((fieldNum << 3) | 1), Buffer.alloc(8, 0xaa)]);
}

function encodeFieldFixed32(fieldNum: number): Buffer {
  return Buffer.concat([encodeVarint((fieldNum << 3) | 5), Buffer.alloc(4, 0x55)]);
}

describe('sqlite-proto protobuf & WAL signature', () => {
  test('readVarintBigInt handles >32-bit unsigned integers without bit truncation', () => {
    const bigVal = 5_000_000_000n;
    const encoded = encodeVarint(bigVal);
    const decoded = readVarintBigInt(encoded, 0);
    expect(decoded).not.toBeNull();
    expect(decoded!.value).toBe(bigVal);
    expect(decoded!.nextPos).toBe(encoded.length);
  });

  test('parseProto handles wire types 0, 1, 2, 5 and ignores trailing malformed data safely', () => {
    const msg = Buffer.concat([
      encodeFieldVarint(1, 5_000_000_000n),
      encodeFieldFixed64(2),
      encodeFieldBytes(3, 'hello'),
      encodeFieldFixed32(4)
    ]);

    const parsed = parseProto(msg);
    expect(parsed.get(1)).toBe(5_000_000_000);
    expect(Buffer.isBuffer(parsed.get(2))).toBe(true);
    expect((parsed.get(2) as Buffer).length).toBe(8);
    expect((parsed.get(3) as Buffer).toString('utf8')).toBe('hello');
    expect((parsed.get(4) as Buffer).length).toBe(4);
  });

  test('extractGenMetadataStep decodes nested token usage, timings, model name, and stepIdx', () => {
    const usage = Buffer.concat([
      encodeFieldVarint(2, 1200),
      encodeFieldVarint(3, 450),
      encodeFieldVarint(5, 8000),
      encodeFieldVarint(9, 100),
      encodeFieldVarint(10, 350)
    ]);
    const ttft = Buffer.concat([encodeFieldVarint(1, 2), encodeFieldVarint(2, 500_000_000)]);
    const stream = Buffer.concat([encodeFieldVarint(1, 4), encodeFieldVarint(2, 250_000_000)]);
    const chat = Buffer.concat([
      encodeFieldBytes(4, usage),
      encodeFieldBytes(11, ttft),
      encodeFieldBytes(12, stream),
      encodeFieldBytes(19, 'gemini-3.8-flash-n')
    ]);
    const root = Buffer.concat([encodeFieldBytes(1, chat), encodeFieldBytes(2, encodeVarint(7))]);

    const step = extractGenMetadataStep(root);
    expect(step.inTok).toBe(1200);
    expect(step.outTok).toBe(450);
    expect(step.cacheRead).toBe(8000);
    expect(step.thinkTok).toBe(100);
    expect(step.respTok).toBe(350);
    expect(step.ctx).toBe(9200);
    expect(step.ttftSec).toBeCloseTo(2.5, 6);
    expect(step.streamSec).toBeCloseTo(4.25, 6);
    expect(step.totDur).toBeCloseTo(6.75, 6);
    expect(step.rawModelId).toBe('gemini-3.8-flash-n');
    expect(step.modelName).toBe('Gemini 3.8 Flash (High)');
    expect(step.stepIdx).toBe(7);
  });

  test('extractToolInfo extracts nested tool name at 5 -> 4 -> 2', () => {
    const inner4 = encodeFieldBytes(2, 'run_command');
    const inner5 = encodeFieldBytes(4, inner4);
    const payload = encodeFieldBytes(5, inner5);
    expect(extractToolInfo(payload)).toBe('run_command');
    expect(extractToolInfo(Buffer.alloc(0))).toBeNull();
  });

  test('extractTimestampFromStepMeta decodes epoch seconds and filters invalid low values', () => {
    const valid = encodeFieldBytes(1, encodeFieldVarint(1, 1_762_680_000));
    const tooSmall = encodeFieldBytes(1, encodeFieldVarint(1, 12345));
    expect(extractTimestampFromStepMeta(valid)).toBe(1_762_680_000);
    expect(extractTimestampFromStepMeta(tooSmall)).toBeNull();
  });

  test('getDbSignature combines main db and -wal file signatures', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-sig-test-'));
    try {
      const dbPath = path.join(tmpDir, 'conv.db');
      const walPath = `${dbPath}-wal`;
      expect(getDbSignature(dbPath)).toBeNull();

      fs.writeFileSync(dbPath, 'sqlite-dummy');
      const sigBeforeWal = getDbSignature(dbPath);
      expect(sigBeforeWal).toContain('|0:0');

      fs.writeFileSync(walPath, 'wal-page-1');
      const sigAfterWal = getDbSignature(dbPath);
      expect(sigAfterWal).not.toBeNull();
      expect(sigAfterWal).not.toBe(sigBeforeWal);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
