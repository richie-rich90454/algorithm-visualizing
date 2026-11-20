/**
 * partition-number-hardy-ramanujan.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./partition-number-hardy-ramanujan";
import type { VisualFrame } from "@/types";

/** Dynamic-programming reference for partition numbers. */
function partitionNumbers(limit: number): number[] {
    const p = new Array<number>(limit + 1).fill(0);
    p[0] = 1;
    for (let part = 1; part <= limit; part += 1) {
        for (let sum = part; sum <= limit; sum += 1) {
            p[sum] = (p[sum] ?? 0) + (p[sum - part] ?? 0);
        }
    }
    return p;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Partition Number (Hardy-Ramanujan-Rademacher)", () => {
    it("matches the DP reference for n = 1..30", () => {
        const reference = partitionNumbers(30);
        for (let n = 1; n <= 30; n += 1) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const value = Number(frames[frames.length - 1]?.meta["value"]);
            expect(value).toBe(reference[n]);
        }
    });

    it("matches known partition values", () => {
        const known: Array<[number, number]> = [[4, 5], [5, 7], [10, 42], [20, 627], [50, 204226]];
        for (const [n, expected] of known) {
            const frames = [...mod.run({ n })];
            expect(Number(frames[frames.length - 1]?.meta["value"])).toBe(expected);
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
