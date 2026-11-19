import { describe, expect, it } from "vitest";
import mod from "./integer-nth-root";
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

function rootFrom(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["root"]);
}

function powLeq(r: number, n: number, x: number): boolean {
    let value = 1n;
    for (let i = 0; i < n; i += 1) value *= BigInt(r);
    return value <= BigInt(x);
}

describe("Integer Nth Root", () => {
    it("matches an incremental brute-force root on many inputs", () => {
        let seed = 5150;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const x = next() % 20000;
            const n = 2 + (trial % 5);
            const frames = [...mod.run({ x, n })];
            checkFrames(frames);
            let expected = 0;
            while (powLeq(expected + 1, n, x)) expected += 1;
            expect(rootFrom(frames)).toBe(expected);
        }
    });

    it("handles zero, one, perfect powers, and non-perfect powers", () => {
        expect(rootFrom([...mod.run({ x: 0, n: 2 })])).toBe(0);
        expect(rootFrom([...mod.run({ x: 1, n: 7 })])).toBe(1);
        expect(rootFrom([...mod.run({ x: 59049, n: 10 })])).toBe(3);
        expect(rootFrom([...mod.run({ x: 1000000, n: 3 })])).toBe(100);
        expect(rootFrom([...mod.run({ x: 999999, n: 2 })])).toBe(999);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
