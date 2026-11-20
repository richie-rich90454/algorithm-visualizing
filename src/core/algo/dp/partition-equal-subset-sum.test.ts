/**
 * partition-equal-subset-sum.test.ts - Brute-force verification and frame checks.
 */

import { describe, expect, it } from "vitest";
import module from "./partition-equal-subset-sum";

function collect(input: unknown) {
    const frames = [];
    for (const frame of module.run(input)) {
        frames.push(frame);
        if (frames.length > 100000) {
            throw new Error("generator did not terminate");
        }
    }
    return frames;
}

/** Exhaustive subset enumeration, independent of the module's DP table. */
function bruteForce(values: number[]): boolean {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total % 2 === 1) {
        return false;
    }
    const target = total / 2;
    for (let mask = 0; mask < 2 ** values.length; mask += 1) {
        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            if (mask & (1 << i)) {
                sum += values[i] ?? 0;
            }
        }
        if (sum === target) {
            return true;
        }
    }
    return false;
}

describe("partitionEqualSubsetSum", () => {
    it("agrees with exhaustive subset enumeration", () => {
        const cases: number[][] = [
            [],
            [1],
            [1, 1],
            [1, 5, 11, 5],
            [1, 2, 3, 4],
            [1, 2, 3, 5],
            [2, 2, 2, 2, 2, 2],
        ];
        for (let trial = 0; trial < 25; trial += 1) {
            const values: number[] = [];
            const size = trial % 9;
            for (let i = 0; i < size; i += 1) {
                values.push(((i * 13 + trial * 5) % 11) + 1);
            }
            cases.push(values);
        }
        for (const values of cases) {
            const frames = collect({ values });
            const final = frames[frames.length - 1]!;
            expect(final.meta.canPartition).toBe(bruteForce(values));
        }
    });

    it("emits well-formed grid frames and terminates", () => {
        for (const values of [[1, 5, 11, 5], [1, 2, 3], []]) {
            const frames = collect({ values });
            const lines = module.pseudocode?.length ?? 1;
            const total = values.reduce((sum, value) => sum + value, 0);
            const target = Math.floor(total / 2);
            frames.forEach((frame, index) => {
                expect(frame.stepNumber).toBe(index);
                expect(frame.description.length).toBeGreaterThanOrEqual(10);
                expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
                expect(frame.codeLineNumber).toBeLessThan(lines);
                expect(frame.layout).toBe("grid");
                expect(frame.meta.rows).toBe(values.length + 1);
                expect(frame.meta.cols).toBe(target + 1);
                expect(typeof frame.meta.canPartition).toBe("boolean");
                for (const entity of frame.entities) {
                    expect(entity.type).toBe("cell");
                    const row = entity.metadata.row as number;
                    const col = entity.metadata.col as number;
                    expect(row).toBeGreaterThanOrEqual(0);
                    expect(row).toBeLessThan(values.length + 1);
                    expect(col).toBeGreaterThanOrEqual(0);
                    expect(col).toBeLessThan(target + 1);
                }
            });
            expect(frames.length).toBeGreaterThan(1);
        }
    });
});
