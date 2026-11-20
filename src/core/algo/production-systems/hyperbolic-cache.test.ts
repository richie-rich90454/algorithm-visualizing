/** hyperbolic-cache.test.ts - Independent admission model, property cross-check, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./hyperbolic-cache";
import type { VisualFrame } from "@/types";

function reference(trace: string[], capacity: number, exponent: number): { hits: number; admitted: number; cached: string[] } {
    const freq = new Map<string, number>();
    const cached: string[] = [];
    let total = 0;
    let hits = 0;
    let admitted = 0;
    const H = (d: number): number => { let s = 0; for (let r = 1; r <= d; r += 1) { s += 1 / Math.pow(r, exponent); } return s; };
    for (const key of trace) {
        total += 1;
        freq.set(key, (freq.get(key) ?? 0) + 1);
        if (cached.includes(key)) { hits += 1; continue; }
        const target = freq.get(key) ?? 0;
        let rank = 1;
        for (const v of freq.values()) { if (v > target) { rank += 1; } }
        const d = Math.max(1, freq.size);
        const probability = Math.pow(rank, -exponent) / H(d);
        const threshold = total * probability;
        if ((freq.get(key) ?? 0) > threshold) {
            admitted += 1;
            if (cached.length >= capacity) {
                let victim = 0;
                for (let i = 1; i < cached.length; i += 1) {
                    if ((freq.get(cached[i] ?? "") ?? 0) < (freq.get(cached[victim] ?? "") ?? 0)) { victim = i; }
                }
                cached.splice(victim, 1);
            }
            cached.push(key);
        }
    }
    return { hits, admitted, cached };
}

function checkFrames(frames: VisualFrame[], traceLen: number, capacity: number): void {
    expect(frames.length).toBe(traceLen + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(capacity);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("HyperbolicCache", () => {
    it("matches an independent admission model", () => {
        const cases = [
            { trace: ["a", "a", "b", "c", "a", "d", "b", "a", "e", "b"], capacity: 3, exponent: 0.8 },
            { trace: ["x", "y", "x", "x", "z", "x", "w"], capacity: 2, exponent: 1.2 },
            { trace: ["a", "b", "c", "d", "e", "a"], capacity: 4, exponent: 0.5 },
        ];
        for (const input of cases) {
            const expected = reference(input.trace, input.capacity, input.exponent);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.trace.length, input.capacity);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["hits"]).toBe(expected.hits);
            expect(final?.["admitted"]).toBe(expected.admitted);
            expect(final?.["cached"]).toEqual(expected.cached);
        }
    });

    it("never exceeds capacity and reproduces random traces", () => {
        let seed = 29;
        for (let trial = 0; trial < 15; trial += 1) {
            const capacity = 2 + (trial % 4);
            const exponent = 0.5 + (trial % 5) * 0.2;
            const trace: string[] = [];
            for (let i = 0; i < 20; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                trace.push(String.fromCharCode(97 + (seed % 6)));
            }
            const expected = reference(trace, capacity, exponent);
            const frames = [...mod.run({ trace, capacity, exponent })];
            checkFrames(frames, trace.length, capacity);
            frames.forEach((frame) => {
                expect((frame.meta["cached"] as string[]).length).toBeLessThanOrEqual(capacity);
            });
            expect(frames[frames.length - 1]?.meta["hits"]).toBe(expected.hits);
            expect([...mod.run({ trace, capacity, exponent })]).toEqual(frames);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
