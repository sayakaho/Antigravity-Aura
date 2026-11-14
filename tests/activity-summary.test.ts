import { describe, expect, test } from 'bun:test';
import {
  extractActivityCountsFromSegment,
  formatActivitySummary,
  type ActivityCounts
} from '../src/injection/activity-summary';

describe('extractActivityCountsFromSegment', () => {
  test('returns zeros for null or invalid segments', () => {
    const emptyCounts: ActivityCounts = {
      commands: 0,
      searches: 0,
      pages: 0,
      filesRead: 0,
      filesEdited: 0,
      subagents: 0,
      otherTools: 0,
      failed: 0
    };
    expect(extractActivityCountsFromSegment(null)).toEqual(emptyCounts);
    expect(extractActivityCountsFromSegment(undefined)).toEqual(emptyCounts);
    expect(extractActivityCountsFromSegment({})).toEqual(emptyCounts);
    expect(extractActivityCountsFromSegment({ steps: 'not-array' })).toEqual(emptyCounts);
  });

  test('correctly tallies tools and tracks failures across formats', () => {
    const mockSegment = {
      steps: [
        {
          metadata: { toolCall: { name: 'run_command' } },
          status: 2
        },
        {
          clientSideToolCall: { name: 'search_web' },
          status: 2
        },
        {
          step: { value: { toolName: 'fetch_web_page' } },
          status: 2
        },
        {
          step: { value: { name: 'read_file' } },
          status: 2
        },
        {
          step: { value: { toolCall: { name: 'edit_file' } } },
          status: 4 // Failed
        },
        {
          metadata: { toolCall: { name: 'write_file' } },
          isError: true // Also failed
        },
        {
          metadata: { toolCall: { name: 'invoke_subagent' } },
          status: 2
        },
        {
          metadata: { toolCall: { name: 'custom_mcp_tool' } },
          status: 2
        }
      ]
    };

    const counts = extractActivityCountsFromSegment(mockSegment);
    expect(counts.commands).toBe(1);
    expect(counts.searches).toBe(1);
    expect(counts.pages).toBe(1);
    expect(counts.filesRead).toBe(1);
    expect(counts.filesEdited).toBe(2);
    expect(counts.subagents).toBe(1);
    expect(counts.otherTools).toBe(1);
    expect(counts.failed).toBe(2);
  });
});

describe('formatActivitySummary', () => {
  test('returns empty string when no activities occurred', () => {
    const zeroCounts: ActivityCounts = {
      commands: 0,
      searches: 0,
      pages: 0,
      filesRead: 0,
      filesEdited: 0,
      subagents: 0,
      otherTools: 0,
      failed: 0
    };
    expect(formatActivitySummary(zeroCounts, 'default')).toBe('');
    expect(formatActivitySummary(zeroCounts, 'zh-CN')).toBe('');
  });

  test('formats singular units in English', () => {
    const counts: ActivityCounts = {
      commands: 1,
      searches: 1,
      pages: 1,
      filesRead: 1,
      filesEdited: 1,
      subagents: 1,
      otherTools: 1,
      failed: 1
    };
    expect(formatActivitySummary(counts, 'default')).toBe(
      '1 command, 1 search, 1 page, read 1 file, edited 1 file, 1 subagent, 1 tool, 1 failed'
    );
  });

  test('formats plural units in English', () => {
    const counts: ActivityCounts = {
      commands: 3,
      searches: 2,
      pages: 4,
      filesRead: 5,
      filesEdited: 2,
      subagents: 2,
      otherTools: 3,
      failed: 2
    };
    expect(formatActivitySummary(counts, 'default')).toBe(
      '3 commands, 2 searches, 4 pages, read 5 files, edited 2 files, 2 subagents, 3 tools, 2 failed'
    );
  });

  test('formats in Chinese localization', () => {
    const counts: ActivityCounts = {
      commands: 2,
      searches: 1,
      pages: 0,
      filesRead: 4,
      filesEdited: 1,
      subagents: 0,
      otherTools: 0,
      failed: 1
    };
    expect(formatActivitySummary(counts, 'zh-CN')).toBe(
      '2 个命令，1 次搜索，读 4 个文件，改 1 个文件，1 次失败'
    );
  });
});
