import { describe, expect, it } from "vitest";
import mod from "./random-number-lcg";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, number | string | boolean | number[]> {
    return frames[frames.length - 1]?.meta as Record<string, number | string | boolean | number[]>;
}

describe("Linear Congruential Generator", () => {
    it("obeys the recurrence on random parameters", () => {
        let seed = 77123;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const m = 8 + (next() % 500);
            const a = next() % 500;
            const c = next() % 500;
            const initial = next() % m;
            const count = 12;
            const frames = [...mod.run({ a, c, m, seed: initial, count })];
            checkFrames(frames);
            const sequence = finalMeta(frames)["sequence"] as number[];
            expect(sequence.length).toBe(count);
            let state = initial;
            for (let i = 0; i < count; i += 1) {
                state = (a * state + c) % m;
                expect(sequence[i]).toBe(state);
                expect(sequence[i]!).toBeGreaterThanOrEqual(0);
                expect(sequence[i]!).toBeLessThan(m);
            }
        }
    });

    it("detects full period for a Hull-Dobell generator", () => {
        const frames = [...mod.run({ a: 5, c: 3, m: 16, seed: 7, count: 16 })];
        const meta = finalMeta(frames);
        expect(meta["fullPeriod"]).toBe(true);
        expect(Number(meta["period"])).toBe(16);
        const sequence = new Set(meta["sequence"] as number[]);
        expect(sequence.size).toBe(16);
    });

    it("reports a shorter period for a poor choice of constants", () => {
        const frames = [...mod.run({ a: 1, c: 0, m: 12, seed: 5, count: 10 })];
        const meta = finalMeta(frames);
        expect(Number(meta["period"])).toBe(1);
        expect(meta["fullPeriod"]).toBe(false);
        const sequence = meta["sequence"] as number[];
        expect(sequence.every((v) => v === 5)).toBe(true);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
