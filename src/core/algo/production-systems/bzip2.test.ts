/** bzip2.test.ts - Full pipeline round-trip, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./bzip2";
import type { VisualFrame } from "@/types";

/** Invert the Burrows-Wheeler transform given the last column and sentinel. */
function inverseBwt(last: string, sentinel: string): string {
    const n = last.length;
    const first = [...last].sort();
    const start = new Map<string, number>();
    for (let i = 0; i < n; i += 1) {
        const c = first[i] as string;
        if (!start.has(c)) start.set(c, i);
    }
    const seen = new Map<string, number>();
    const lf: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const c = last[i] as string;
        const rank = seen.get(c) ?? 0;
        seen.set(c, rank + 1);
        lf.push((start.get(c) as number) + rank);
    }
    let row = [...last].indexOf(sentinel);
    const out: string[] = [];
    for (let k = 0; k < n; k += 1) {
        out.push(last[row] as string);
        row = lf[row] as number;
    }
    return out.reverse().join("");
}

/** Decode the bit stream and reverse the three coding stages. */
function roundTrip(meta: VisualFrame["meta"]): string {
    const codes = new Map<string, string>();
    for (const entry of meta["codes"] as string[]) {
        const colon = entry.indexOf(":");
        codes.set(entry.slice(0, colon), entry.slice(colon + 1));
    }
    const reverse = new Map<string, string>();
    for (const [key, code] of codes) reverse.set(code, key);

    const bits = meta["bits"] as string;
    const symbols: string[] = [];
    let buffer = "";
    for (const bit of bits) {
        buffer += bit;
        const symbol = reverse.get(buffer);
        if (symbol !== undefined) {
            symbols.push(symbol);
            buffer = "";
        }
    }
    expect(buffer).toBe("");

    const numbers = symbols.map((s) => Number.parseInt(s.slice(1), 10));
    const values: number[] = [];
    for (let i = 0; i < numbers.length; i += 2) {
        const value = numbers[i] as number;
        const count = numbers[i + 1] as number;
        for (let k = 0; k < count; k += 1) values.push(value);
    }
    expect(values.length).toBe(meta["originalSymbols"] as number);

    const alphabet = meta["alphabet"] as string[];
    const sentinel = meta["sentinel"] as string;
    const working = [...alphabet];
    const bwtChars: string[] = [];
    for (const rank of values) {
        const c = working[rank] as string;
        bwtChars.push(c);
        working.splice(rank, 1);
        working.unshift(c);
    }
    const last = bwtChars.join("");
    return inverseBwt(last, sentinel).slice(0, -1);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("bzip2 block compression", () => {
    const cases = ["BANANA", "AAAA", "ABABAB", "HELLO WORLD", "MISSISSIPPI", "XYZ", "ABRACADABRAABRACADABRA"];

    it("round-trips every test block through all four stages", () => {
        for (const text of cases) {
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            expect(final.meta["stage"]).toBe("done");
            expect(roundTrip(final.meta)).toBe(text);
        }
    });

    it("produces a prefix-free codebook with unique codes", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1] as VisualFrame;
        const codes = (final.meta["codes"] as string[]).map((e) => e.slice(e.indexOf(":") + 1));
        expect(new Set(codes).size).toBe(codes.length);
        for (let i = 0; i < codes.length; i += 1) {
            for (let j = 0; j < codes.length; j += 1) {
                if (i !== j) expect((codes[j] as string).startsWith(codes[i] as string)).toBe(false);
            }
        }
    });

    it("uses a sentinel absent from the source", () => {
        const frames = [...mod.run({ text: "ABC|DEF" })];
        const first = frames[0] as VisualFrame;
        expect(first.meta["sentinel"]).not.toBe("|");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
