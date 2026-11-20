/** divisor-sieve.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./divisor-sieve";
import type { VisualFrame } from "@/types";

/** Independent brute-force divisor count. */
function bruteTau(n: number): number[] {
    const out: number[] = [0];
    for (let k = 1; k <= n; k += 1) {
        let count = 0;
        for (let d = 1; d <= k; d += 1) {
            if (k % d === 0) {
                count += 1;
            }
        }
        out.push(count);
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const pc = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(pc);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(entity.metadata.row).toBeDefined();
            expect(entity.metadata.col).toBeDefined();
        }
    });
}

describe("Divisor-counting sieve", () => {
    it("matches a brute-force divisor count for every k", () => {
        for (const n of [1, 6, 24, 50]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            const table = finalMeta?.["table"] as Array<number | string>;
            expect(Array.isArray(table)).toBe(true);
            const reference = bruteTau(n);
            expect(table.length).toBe(n);
            for (let k = 1; k <= n; k += 1) {
                expect(Number(table[k - 1])).toBe(reference[k]);
            }
            expect(Number(finalMeta?.["tauN"])).toBe(reference[n]);
        }
    });

    it("keeps partial tau values bounded by the number of divisors so far", () => {
        const frames = [...mod.run({ n: 12 })];
        for (const frame of frames) {
            for (const entity of frame.entities) {
                const value = Number(entity.value);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(12);
            }
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
