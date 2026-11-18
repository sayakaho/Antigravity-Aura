import { describe, expect, test } from "bun:test";
import { getLocalePackage, LOCALES } from "../src/injection/locales";

describe("Universal Locales Engine & ja-JP Package", () => {
  test("registers zh-CN, ja-JP, and ko-KR in LOCALES registry cleanly", () => {
    expect(LOCALES["zh-CN"]).toBeDefined();
    expect(LOCALES["ja-JP"]).toBeDefined();
    expect(LOCALES["ko-KR"]).toBeDefined();
    expect(LOCALES["zh-CN"].code).toBe("zh-CN");
    expect(LOCALES["ja-JP"].code).toBe("ja-JP");
    expect(LOCALES["ko-KR"].code).toBe("ko-KR");
    expect(LOCALES["ja-JP"].label).toBe("日本語 (Japanese)");
    expect(LOCALES["ko-KR"].label).toBe("한국어 (Korean)");

    expect(getLocalePackage("zh-CN")).toBe(LOCALES["zh-CN"]);
    expect(getLocalePackage("ja-JP")).toBe(LOCALES["ja-JP"]);
    expect(getLocalePackage("ko-KR")).toBe(LOCALES["ko-KR"]);
    expect(getLocalePackage("default")).toBeNull();
    expect(getLocalePackage(null)).toBeNull();
  });

  test("ja-JP and ko-KR translations match zh-CN key set 1:1 with zero missing keys", () => {
    const zhPkg = LOCALES["zh-CN"];
    const jaPkg = LOCALES["ja-JP"];
    const koPkg = LOCALES["ko-KR"];

    const zhKeys = Object.keys(zhPkg.translations);
    const jaKeys = Object.keys(jaPkg.translations);
    const koKeys = Object.keys(koPkg.translations);

    expect(zhKeys.length).toBe(1748);
    expect(jaKeys.length).toBe(1748);
    expect(koKeys.length).toBe(1748);

    const missingInJa = zhKeys.filter(k => !(k in jaPkg.translations));
    expect(missingInJa).toEqual([]);

    const missingInKo = zhKeys.filter(k => !(k in koPkg.translations));
    expect(missingInKo).toEqual([]);
  });

  test("preserves developer-native technical terms in Korean without clumsy literal translation", () => {
    const ko = LOCALES["ko-KR"].translations;

    expect(ko["Subagents"]).toBe("Subagents");
    expect(ko["Artifacts"]).toBe("Artifacts");
    expect(ko["Open Diff"]).toBe("Diff 열기");
    expect(ko["Binary file — cannot display diff"]).toBe("바이너리 파일 — Diff를 표시할 수 없습니다");
    expect(ko["Fork"]).toBe("Fork");
    expect(ko["Hooks"]).toBe("Hooks");
    expect(ko["Best of N"]).toBe("Best of N");
    expect(ko["Worktree"]).toBe("Worktree");
  });

  test("executes Korean dynamic pattern replacements with correct particles and counters", () => {
    const koPkg = LOCALES["ko-KR"];
    const filesRule = koPkg.patterns.find(p => p.id === "files_changed");
    expect(filesRule).toBeDefined();
    expect("5 files changed".replace(filesRule!.pattern, filesRule!.replace as string)).toBe("5개 파일 변경됨");

    const toolsRule = koPkg.patterns.find(p => p.id === "tools");
    expect(toolsRule).toBeDefined();
    expect("3 tools".replace(toolsRule!.pattern, toolsRule!.replace as string)).toBe("3개 도구");

    const demotedRule = koPkg.patterns.find(p => p.id === "demoted");
    expect(demotedRule).toBeDefined();
    expect("2 demoted".replace(demotedRule!.pattern, demotedRule!.replace as string)).toBe("2개 강등됨");

    const activity = koPkg.messages.activitySummary;
    expect(activity.commands(4)).toBe("4개 명령");
    expect(activity.subagents(2)).toBe("2개 Subagent");
    expect(activity.filesRead(3)).toBe("3개 파일 읽음");
    expect(activity.filesEdited(1)).toBe("1개 파일 수정");
  });

  test("preserves developer-native technical terms without clumsy literal translation", () => {
    const ja = LOCALES["ja-JP"].translations;

    expect(ja["Subagents"]).toBe("Subagents");
    expect(ja["Stop Subagent"]).toBe("Subagent を停止");
    expect(ja["Browser Subagent"]).toBe("ブラウザ Subagent");
    expect(ja["Artifacts"]).toBe("Artifacts");
    expect(ja["Artifact Comments"]).toBe("Artifact コメント");
    expect(ja["Open Diff"]).toBe("Diff を開く");
    expect(ja["Binary file — cannot display diff"]).toBe("バイナリファイル — Diff を表示できません");
    expect(ja["Fork"]).toBe("Fork");
    expect(ja["Hooks"]).toBe("Hooks");
    expect(ja["Best of N"]).toBe("Best of N");
    expect(ja["Worktree"]).toBe("Worktree");
    expect(ja["Worktree branch"]).toBe("Worktree ブランチ");
  });

  test("executes Japanese dynamic pattern replacements with correct particles and counters", () => {
    const jaPkg = LOCALES["ja-JP"];
    const filesRule = jaPkg.patterns.find(p => p.id === "files_changed");
    expect(filesRule).toBeDefined();
    expect("5 files changed".replace(filesRule!.pattern, filesRule!.replace as string)).toBe("5 件のファイルを変更");

    const toolsRule = jaPkg.patterns.find(p => p.id === "tools");
    expect(toolsRule).toBeDefined();
    expect("3 tools".replace(toolsRule!.pattern, toolsRule!.replace as string)).toBe("3 個のツール");

    const demotedRule = jaPkg.patterns.find(p => p.id === "demoted");
    expect(demotedRule).toBeDefined();
    expect("2 demoted".replace(demotedRule!.pattern, demotedRule!.replace as string)).toBe("2 件を降格");

    const activity = jaPkg.messages.activitySummary;
    expect(activity.commands(4)).toBe("4 件のコマンド");
    expect(activity.subagents(2)).toBe("2 件の Subagent");
    expect(activity.filesRead(3)).toBe("3 件のファイルを閲覧");
    expect(activity.filesEdited(1)).toBe("1 件のファイルを編集");
  });
});
