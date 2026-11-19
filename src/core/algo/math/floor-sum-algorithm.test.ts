import { describe, expect, it } from "vitest";
import mod from "./floor-sum-algorithm";
import type { VisualFrame } from "@/types";

function brute(n: number, m: number, a: number, b: number): number {
    let total = 0;
    for (let k = 0; k < n; k += 1) {
        total += Math.floor((a * k + b) / m);
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Euclidean Floor Sum", () => {
    it("matches direct summation on random nonnegative parameters", () => {
        let seed = 24680;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const n = next() % 60;
            const m = (next() % 50) + 1;
            const a = next() % 200;
            const b = next() % 200;
            const frames = [...mod.run({ n, m, a, b })];
            checkFrames(frames);
            expect(Number(frames[frames.length - 1]?.meta["answer"])).toBe(brute(n, m, a, b));
        }
    });

    it("matches direct summation with negative a or b", () => {
        for (const [n, m, a, b] of [
            [10, 7, -3, 5],
            [12, 5, 2, -11],
            [8, 9, -13, -4],
            [15, 3, 7, -2],
        ]) {
            const frames = [...mod.run({ n, m, a, b })];
            expect(Number(frames[frames.length - 1]?.meta["answer"])).toBe(brute(n, m, a, b));
        }
    });

    it("handles n = 0 and a = 0", () => {
        const emptyFrames = [...mod.run({ n: 0, m: 5, a: 3, b: 2 })];
        expect(Number(emptyFrames[emptyFrames.length - 1]?.meta["answer"])).toBe(0);
        const frames = [...mod.run({ n: 10, m: 5, a: 0, b: 3 })];
        expect(Number(frames[frames.length - 1]?.meta["answer"])).toBe(brute(10, 5, 0, 3));
    });

    it("solves the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(Number(frames[frames.length - 1]?.meta["answer"])).toBe(22);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
