import { describe, expect, it } from "vitest";
import mod from "./matrix-multiplication-block";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.metadata["row"] !== undefined && e.metadata["col"] !== undefined)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function naive(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const c = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let k = 0; k < n; k += 1) {
            for (let j = 0; j < n; j += 1) {
                c[i]![j] = c[i]![j]! + a[i]![k]! * b[k]![j]!;
            }
        }
    }
    return c;
}

function productFrom(frames: VisualFrame[]): number[][] {
    const flat = (frames[frames.length - 1]?.meta["product"] as number[]) ?? [];
    const n = Number(frames[frames.length - 1]?.meta["n"] ?? 0);
    return Array.from({ length: n }, (_, i) => flat.slice(i * n, (i + 1) * n));
}

describe("Blocked Matrix Multiplication", () => {
    it("matches the naive triple loop for several sizes and block widths", () => {
        let seed = 61211;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (const n of [2, 3, 4, 6]) {
            for (const block of [1, 2, 3]) {
                const a = Array.from({ length: n }, () => Array.from({ length: n }, () => (next() % 11) - 5));
                const b = Array.from({ length: n }, () => Array.from({ length: n }, () => (next() % 11) - 5));
                const frames = [...mod.run({ a, b, block })];
                checkFrames(frames);
                const expected = naive(a, b);
                const actual = productFrom(frames);
                for (let i = 0; i < n; i += 1) {
                    for (let j = 0; j < n; j += 1) expect(actual[i]![j]).toBe(expected[i]![j]);
                }
            }
        }
    });

    it("returns the identity product unchanged on the default input", () => {
        const input = mod.defaultInput as { a: number[][]; b: number[][] };
        const frames = [...mod.run(mod.defaultInput)];
        const actual = productFrom(frames);
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) expect(actual[i]![j]).toBe(input.a[i]![j]);
        }
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
