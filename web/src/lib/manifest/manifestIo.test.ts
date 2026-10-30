import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isWeekStart,
  listWeeks,
  manifestHashes,
  readManifest,
  readOtherTrainingFile,
  readRunTemplateFile,
  writeManifest,
  writeOtherTrainingFile,
  writeRunTemplateFile,
} from "./manifestIo";

/* A SCRATCH REGISTRY, never `athletes/` -- the athlete's history is not test
 * data, and a suite that wrote into the real registry would be editing the
 * measurements it grades. */
let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-io-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const manifest = (weekStart: string) => ({
  week_start: weekStart,
  runs: [],
  rest_days: [],
  notes: {},
});

describe("listWeeks", () => {
  it("is empty for an athlete with no weeks directory", () => {
    expect(listWeeks("nobody", root)).toEqual([]);
  });

  it("lists week starts sorted and ignores whatever else is in there", () => {
    writeManifest("a", "2026-09-14", manifest("2026-09-14"), root);
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    fs.writeFileSync(path.join(root, "a", "weeks", "notes.txt"), "x");
    expect(listWeeks("a", root)).toEqual(["2026-09-07", "2026-09-14"]);
  });
});

describe("readManifest", () => {
  it("returns null for a week nobody authored -- the create signal", () => {
    expect(readManifest("a", "2026-09-07", root)).toBeNull();
  });

  it("round-trips what writeManifest wrote", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    expect(readManifest("a", "2026-09-07", root)).toEqual(
      manifest("2026-09-07"),
    );
  });
});

describe("writeManifest", () => {
  it("writes the normalized form: 2-space, LF only, one trailing newline", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    const raw = fs.readFileSync(
      path.join(root, "a", "weeks", "2026-09-07.json"),
      "utf-8",
    );
    expect(raw.endsWith("}\n")).toBe(true);
    expect(raw.includes("\r")).toBe(false);
    expect(raw).toContain('  "week_start"');
  });

  it("leaves no .tmp behind -- the write is rename-over", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    const files = fs.readdirSync(path.join(root, "a", "weeks"));
    expect(files).toEqual(["2026-09-07.json"]);
  });

  it("refuses a manifest whose week_start is not the filename's", () => {
    expect(() =>
      writeManifest("a", "2026-09-07", manifest("2026-09-14"), root),
    ).toThrow(/one fact stated twice/);
  });
});

describe("what may become a path", () => {
  it("refuses a slug with a separator rather than normalising it", () => {
    expect(() => readManifest("../x", "2026-09-07", root)).toThrow(/slug/);
    expect(() =>
      writeManifest("a/b", "2026-09-07", manifest("2026-09-07"), root),
    ).toThrow(/slug/);
  });

  it("refuses a week start that is not bare YYYY-MM-DD", () => {
    expect(() => readManifest("a", "../secrets", root)).toThrow(/week start/);
    expect(() => readManifest("a", "2026-09-07.json", root)).toThrow(
      /week start/,
    );
  });

  it("isWeekStart is the same gate", () => {
    expect(isWeekStart("2026-09-07")).toBe(true);
    expect(isWeekStart("2026-9-7")).toBe(false);
    expect(isWeekStart("..")).toBe(false);
  });
});

describe("the run templates file", () => {
  it("reads as an EMPTY FILE where nobody has saved one", () => {
    /* NOT NULL, WHICH IS WHERE THIS DIFFERS FROM `readManifest`. A missing
     * manifest is the create signal because a week must be authored before its
     * days can be; a missing templates file just means the list is empty. */
    const got = readRunTemplateFile("a", root);
    expect(got.run_templates).toEqual([]);
    expect(typeof got._comment).toBe("string");
  });

  it("round-trips what it was handed", () => {
    const file = {
      _comment: "prose",
      run_templates: [{ id: "easy-1", run: { role: "easy" } }],
    };
    writeRunTemplateFile("a", file, root);
    expect(readRunTemplateFile("a", root)).toEqual(file);
  });

  it("writes the manifests' own format: 2-space, LF, trailing newline", () => {
    writeRunTemplateFile("a", { run_templates: [] }, root);
    const text = fs.readFileSync(
      path.join(root, "a", "run-templates.json"),
      "utf-8",
    );
    expect(text).toBe('{\n  "run_templates": []\n}\n');
  });

  it("sits at the athlete root, beside thresholds and NOT under weeks/", () => {
    writeRunTemplateFile("a", { run_templates: [] }, root);
    expect(fs.existsSync(path.join(root, "a", "run-templates.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "a", "weeks"))).toBe(false);
  });

  it("leaves no .tmp behind, so a directory listing is what was written", () => {
    /* The write is atomic -- tmp then rename -- and a leftover would be a file
     * `git status` reports and nobody put there. */
    writeRunTemplateFile("a", { run_templates: [] }, root);
    expect(fs.readdirSync(path.join(root, "a"))).toEqual(["run-templates.json"]);
  });

  it("refuses a slug with a separator rather than normalising it", () => {
    expect(() => readRunTemplateFile("../x", root)).toThrow(/slug/);
    expect(() => writeRunTemplateFile("a/b", { run_templates: [] }, root)).toThrow(
      /slug/,
    );
  });
});

describe("the other training file", () => {
  it("reads as `{days: {}}` where nobody has written one", () => {
    expect(readOtherTrainingFile("a", root)).toEqual({ days: {} });
  });

  it("round-trips what it was handed, newlines intact", () => {
    const file = {
      _comment: "prose",
      days: { "2026-10-12": "Lifting\n  squat 3x5\n\nPT" },
    };
    writeOtherTrainingFile("a", file, root);
    expect(readOtherTrainingFile("a", root)).toEqual(file);
  });

  it("writes the manifests' own format: 2-space, LF, trailing newline", () => {
    writeOtherTrainingFile("a", { days: { "2026-10-12": "PT\nbands" } }, root);
    const text = fs.readFileSync(
      path.join(root, "a", "other-training.json"),
      "utf-8",
    );
    expect(text).toBe('{\n  "days": {\n    "2026-10-12": "PT\\nbands"\n  }\n}\n');
  });

  it("sits at the athlete root and NOT under weeks/ -- or it would be hashed as a week", () => {
    writeOtherTrainingFile("a", { days: {} }, root);
    expect(fs.existsSync(path.join(root, "a", "other-training.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "a", "weeks"))).toBe(false);
  });

  it("WRITING IT MOVES NO MANIFEST HASH -- the reason it is its own file", () => {
    writeManifest("a", "2026-10-12", manifest("2026-10-12"), root);
    const before = manifestHashes("a", root);
    writeOtherTrainingFile("a", { days: { "2026-10-12": "PT" } }, root);
    writeOtherTrainingFile("a", { days: {} }, root);
    expect(manifestHashes("a", root)).toEqual(before);
    expect(listWeeks("a", root)).toEqual(["2026-10-12"]);
  });

  it("leaves no .tmp behind", () => {
    writeOtherTrainingFile("a", { days: {} }, root);
    expect(fs.readdirSync(path.join(root, "a"))).toEqual(["other-training.json"]);
  });

  it("refuses a slug with a separator rather than normalising it", () => {
    expect(() => readOtherTrainingFile("../x", root)).toThrow(/slug/);
    expect(() => writeOtherTrainingFile("a/b", { days: {} }, root)).toThrow(/slug/);
  });
});

describe("manifestHashes", () => {
  it("is empty for an athlete with no weeks directory", () => {
    expect(manifestHashes("nobody", root)).toEqual({});
  });

  it("is the sha256 of each manifest's BYTES, as publish.py hashes it", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    const file = path.join(root, "a", "weeks", "2026-09-07.json");
    const want = createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    expect(manifestHashes("a", root)).toEqual({ "2026-09-07": want });
  });

  it("matches a known digest, so the algorithm cannot drift", () => {
    fs.mkdirSync(path.join(root, "a", "weeks"), { recursive: true });
    fs.writeFileSync(path.join(root, "a", "weeks", "2026-09-07.json"), "abc");
    expect(manifestHashes("a", root)).toEqual({
      "2026-09-07":
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
  });

  it("moves when the file is rewritten with different content", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    const before = manifestHashes("a", root);
    writeManifest("a", "2026-09-07", { ...manifest("2026-09-07"), phase: "B" }, root);
    expect(manifestHashes("a", root)).not.toEqual(before);
  });

  it("does not move when the same manifest is written again", () => {
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    const before = manifestHashes("a", root);
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    expect(manifestHashes("a", root)).toEqual(before);
  });

  it("covers exactly the weeks listWeeks lists", () => {
    writeManifest("a", "2026-09-14", manifest("2026-09-14"), root);
    writeManifest("a", "2026-09-07", manifest("2026-09-07"), root);
    fs.writeFileSync(path.join(root, "a", "weeks", "notes.txt"), "x");
    expect(Object.keys(manifestHashes("a", root))).toEqual(listWeeks("a", root));
  });
});
