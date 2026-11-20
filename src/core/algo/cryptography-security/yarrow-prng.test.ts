/** yarrow-prng.test.ts - Independent generator reference, determinism, reseed properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { addEntropy, generate, mix32, yarrowInit, type YarrowState } from "./yarrow-prng";
import type { VisualFrame } from "@/types";

function refMix(data: number[]): number {
    let h = 2166136261;
    for (const byte of data) {
        h ^= byte & 255;
        h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}
function bytesOf(v: number): number[] {
    return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
}
function refInit(seed: number): YarrowState {
    return { key: refMix([seed & 255, (seed >>> 8) & 255, 7, 13]), counter: 0, reseeds: 0, fast: [], slow: [], sinceReseed: 1 };
}
function refAdd(s: YarrowState, pool: "fast" | "slow", data: number[]): YarrowState {
    const fast = pool === "fast" ? [...s.fast, ...data.map((b) => b & 255)] : s.fast.slice();
    const slow = pool === "slow" ? [...s.slow, ...data.map((b) => b & 255)] : s.slow.slice();
    if (fast.length >= 4 && s.sinceReseed >= 1) {
        return { key: refMix([...bytesOf(s.key), ...slow, ...fast]), counter: 0, reseeds: s.reseeds + 1, fast: [], slow: [], sinceReseed: 0 };
    }
    return { ...s, fast, slow };
}
function refGen(s: YarrowState, n: number): { state: YarrowState; values: number[] } {
    let cur = { ...s, fast: s.fast.slice(), slow: s.slow.slice() };
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        if (cur.sinceReseed >= 16) {
            cur = { key: refMix([...bytesOf(cur.key), ...cur.slow, ...cur.fast]), counter: 0, reseeds: cur.reseeds + 1, fast: [], slow: [], sinceReseed: 0 };
        }
        out.push(refMix([...bytesOf(cur.key), cur.counter & 255, 9]));
        cur = { ...cur, counter: cur.counter + 1, sinceReseed: cur.sinceReseed + 1 };
    }
    return { state: cur, values: out };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Yarrow PRNG (toy model)", () => {
    it("matches an independently transcribed generator over random event streams", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const seed = trial + 1;
            let actual = yarrowInit(seed);
            let expected = refInit(seed);
            expect(actual.key).toBe(expected.key);
            for (let step = 0; step < 25; step += 1) {
                if (step % 3 === 0) {
                    const bytes = Array.from({ length: 1 + (step % 5) }, (_, i) => (trial + step + i) & 255);
                    const pool = step % 2 === 0 ? "fast" : "slow";
                    actual = addEntropy(actual, pool, bytes);
                    expected = refAdd(expected, pool, bytes);
                } else {
                    const count = 1 + (step % 4);
                    const a = generate(actual, count);
                    const e = refGen(expected, count);
                    expect(a.values).toEqual(e.values);
                    actual = a.state;
                    expected = e.state;
                }
                expect(actual).toEqual(expected);
            }
        }
    });

    it("is deterministic and distinguishes different inputs", () => {
        expect(mix32([1, 2, 3])).toBe(mix32([1, 2, 3]));
        expect(mix32([1, 2, 3])).not.toBe(mix32([1, 2, 4]));
        const first = generate(addEntropy(yarrowInit(7), "fast", [1, 2, 3, 4]), 3).values;
        const second = generate(addEntropy(yarrowInit(7), "fast", [1, 2, 3, 4]), 3).values;
        expect(first).toEqual(second);
        expect(new Set(first).size).toBe(3);
    });

    it("reseeds when the fast pool fills and after sixteen blocks", () => {
        const before = yarrowInit(3);
        const after = addEntropy(before, "fast", [1, 2, 3, 4]);
        expect(after.reseeds).toBe(1);
        expect(after.fast.length).toBe(0);
        expect(after.slow.length).toBe(0);
        expect(after.counter).toBe(0);
        const produced = generate(after, 17);
        expect(produced.state.reseeds).toBe(2);
        expect(produced.values.length).toBe(17);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["reseeds"]).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
