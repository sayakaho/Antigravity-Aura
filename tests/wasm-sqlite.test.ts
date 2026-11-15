import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  _setForceWasmOnlyForTesting,
  extractGenMetadataStep,
  hasSqlite,
  initWasmSqlite,
  openDb
} from '../src/server/sqlite-proto';

describe('SQLite WASM Fallback Driver', () => {
  let tmpDir: string;
  let testDbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-wasm-test-'));
    testDbPath = path.join(tmpDir, 'test-session.db');

    // Create a mock SQLite database using DatabaseSync for test fixtures
    const db = new DatabaseSync(testDbPath);
    db.prepare(`
      CREATE TABLE gen_metadata (
        idx INTEGER PRIMARY KEY,
        data BLOB NOT NULL
      )
    `).all();

    // Construct mock protobuf data:
    // field 1 (chat):
    //   field 4 (usage):
    //     field 2 (inTok): 100
    //     field 3 (outTok): 50
    //     field 5 (cacheRead): 30
    //     field 9 (thinkTok): 20
    //   field 19 (rawModelId): "gemini-2.5-pro"
    //   field 21 (rawModelName): "Gemini 2.5 Pro"
    // field 2 (stepIdx): 1
    function encodeVarint(val: number): Buffer {
      const bytes: number[] = [];
      let v = val;
      while (v >= 0x80) {
        bytes.push((v & 0x7f) | 0x80);
        v >>>= 7;
      }
      bytes.push(v);
      return Buffer.from(bytes);
    }
    function encodeTag(fieldNum: number, wireType: number): Buffer {
      return encodeVarint((fieldNum << 3) | wireType);
    }

    const usageBuf = Buffer.concat([
      encodeTag(2, 0), encodeVarint(100), // inTok = 100
      encodeTag(3, 0), encodeVarint(50),  // outTok = 50
      encodeTag(5, 0), encodeVarint(30),  // cacheRead = 30
      encodeTag(9, 0), encodeVarint(20)   // thinkTok = 20
    ]);

    const modelIdBuf = Buffer.from('gemini-2.5-pro');
    const modelNameBuf = Buffer.from('Gemini 2.5 Pro');

    const chatParts: Buffer[] = [
      encodeTag(4, 2), encodeVarint(usageBuf.length),
      usageBuf,
      encodeTag(19, 2), encodeVarint(modelIdBuf.length),
      modelIdBuf,
      encodeTag(21, 2), encodeVarint(modelNameBuf.length),
      modelNameBuf
    ];
    const chatBuf = Buffer.concat(chatParts);

    const rowParts: Buffer[] = [
      encodeTag(1, 2), encodeVarint(chatBuf.length),
      chatBuf,
      encodeTag(2, 2), encodeVarint(2), encodeVarint(1) // stepIdx varint in len-delimited field
    ];
    const mockRowBlob = Buffer.concat(rowParts);

    const insert = db.prepare('INSERT INTO gen_metadata (idx, data) VALUES (?, ?)');
    insert.all(0, mockRowBlob);
    db.close();
  });

  afterEach(() => {
    _setForceWasmOnlyForTesting(false);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('initializes WASM engine and queries database successfully under forced WASM mode', async () => {
    const wasm = await initWasmSqlite();
    expect(wasm).not.toBeNull();

    _setForceWasmOnlyForTesting(true);
    expect(hasSqlite()).toBe(true);

    const db = openDb(testDbPath);
    expect(db).not.toBeNull();

    // Verify PRAGMA schema_version
    const schemaRes = db!.prepare('PRAGMA schema_version').all();
    expect(Array.isArray(schemaRes)).toBe(true);

    // Verify gen_metadata query and protobuf decoding
    const rows = db!.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx ASC').all();
    expect(rows.length).toBe(1);
    expect(rows[0].idx).toBe(0);
    expect(rows[0].data instanceof Uint8Array || Buffer.isBuffer(rows[0].data)).toBe(true);

    const parsed = extractGenMetadataStep(rows[0].data);
    expect(parsed.inTok).toBe(100);
    expect(parsed.outTok).toBe(50);
    expect(parsed.cacheRead).toBe(30);
    expect(parsed.thinkTok).toBe(20);
    expect(parsed.rawModelId).toBe('gemini-2.5-pro');

    db!.close();
  });

  test('gracefully returns empty arrays for missing tables in WASM mode without throwing', async () => {
    await initWasmSqlite();
    _setForceWasmOnlyForTesting(true);

    const db = openDb(testDbPath);
    expect(db).not.toBeNull();

    const missingRows = db!.prepare('SELECT * FROM non_existent_table').all();
    expect(missingRows).toEqual([]);

    const singleRow = db!.prepare('SELECT * FROM non_existent_table').get();
    expect(singleRow).toBeUndefined();

    db!.close();
  });
});
