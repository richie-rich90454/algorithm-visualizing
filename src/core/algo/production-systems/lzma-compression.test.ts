/**
 * lzma-compression.test.ts - Round-trip, reference-parse, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { compress, decompress, lzParse } from "./lzma-compression";
import type { VisualFrame } from "@/types";

type Token = { literal: number } | { length: number; distance: number };

/** Independent brute-force LZ77 parser for comparison. */
function referenceParse(data: number[], window: number): Token[] {
  const out: Token[] = [];
  let at = 0;
  while (at < data.length) {
    let best = 0;
    let dist = 0;
    const limit = Math.min(258, data.length - at);
    for (let back = Math.max(0, at - window); back < at; back += 1) {
      let run = 0;
      while (run < limit && data[back + run] === data[at + run]) run += 1;
      if (run > best) {
        best = run;
        dist = at - back;
      }
    }
    if (best >= 3) {
      out.push({ length: best, distance: dist });
      at += best;
    } else {
      out.push({ literal: data[at] as number });
      at += 1;
    }
  }
  return out;
}

function bytes(text: string): number[] {
  return text.split("").map((ch) => ch.charCodeAt(0));
}

function checkFrames(frames: VisualFrame[], n: number): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(n);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    expect(frame.entities.every((e) => e.metadata.row === 0)).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("LZMA-style compression", () => {
  it("round-trips many inputs exactly", () => {
    const inputs: number[][] = [
      [],
      [65],
      [0, 1, 2, 3],
      bytes("abababababababab"),
      bytes("to be or not to be that is the question to be or not to be"),
      bytes("the quick brown fox jumps over the lazy dog the quick brown fox"),
      Array.from({ length: 300 }, (_, i) => (i * 37 + 11) % 256),
    ];
    for (const input of inputs) {
      const { stream } = compress(input);
      expect(decompress(stream)).toEqual(input);
    }
  });

  it("matches an independent LZ77 parse exactly", () => {
    const text = "aaaaabbbbbabcabcabcxyzxyzxyz";
    const data = bytes(text);
    expect(lzParse(data, 64)).toEqual(referenceParse(data, 64));
    expect(compress(data, 64).tokens).toEqual(referenceParse(data, 64));
  });

  it("shrinks repetitive text and emits match tokens", () => {
    const data = bytes("abcabcabcabcabcabcabcabcabcabc".repeat(3));
    const { stream, tokens } = compress(data, 128);
    expect(tokens.some((t) => "length" in t)).toBe(true);
    expect(stream.length).toBeLessThan(data.length);
    expect(decompress(stream)).toEqual(data);
  });

  it("reports a successful round trip in the final frame", () => {
    const frames = [...mod.run({ text: "compression round trip compression round trip", window: 128 })];
    checkFrames(frames, "compression round trip compression round trip".length);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["roundTripOk"]).toBe(true);
    expect(meta?.["originalBytes"]).toBe("compression round trip compression round trip".length);
    expect(meta?.["tokens"] as number).toBeGreaterThan(0);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
