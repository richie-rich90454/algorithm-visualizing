/**
 * fast-subset-convolution.test.ts - Brute-force convolution check, structure
 * property, frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fast-subset-convolution";
import type { VisualFrame } from "@/types";

/** Direct 3^n definition of subset convolution. */
function brute(f: number[], g: number[]): number[] {
    const size = f.length;
    const out = Array<number>(size).fill(0);
    for (let mask = 0; mask < size; mask += 1) {
        for (let sub = mask; ; sub = (sub - 1) & mask) {
            out[mask] = (out[mask] as number) + (f[sub] as number) * (g[mask ^ sub] as number);
            if (sub === 0) {
                break;
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(rows);
        expect(frame.meta.cols).toBe(cols);
    });
}

describe("FastSubsetConvolution", () => {
    it("matches the direct 3^n definition on random inputs", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 9) - 4;
        };
        for (const n of [1, 2, 3, 4]) {
            const size = 1 << n;
            const f = Array.from({ length: size }, rand);
            const g = Array.from({ length: size }, rand);
            const frames = [...mod.run({ n, f, g })];
            checkFrames(frames, n + 1, size);
            const last = frames[frames.length - 1];
            expect(last?.meta.h).toEqual(brute(f, g));
        }
    });

    it("satisfies the all-ones identity h[S] = 2 raised to popcount(S)", () => {
        const n = 4;
        const size = 1 << n;
        const ones = Array<number>(size).fill(1);
        const frames = [...mod.run({ n, f: ones, g: ones })];
        const h = frames[frames.length - 1]?.meta.h as number[];
        for (let mask = 0; mask < size; mask += 1) {
            let count = 0;
            let value = mask;
            while (value > 0) {
                count += value & 1;
                value >>= 1;
            }
            expect(h[mask]).toBe(1 << count);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
