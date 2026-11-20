/**
 * surface-code-error-correction.test.ts - Brute-force syndrome and decoder cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./surface-code-error-correction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], qubits: number, checks: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(qubits + checks);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent plaquette set: one square per interior grid corner. */
function plaquettes(rows: number, cols: number): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < rows - 1; r += 1) {
        for (let c = 0; c < cols - 1; c += 1) {
            out.push([r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1]);
        }
    }
    return out;
}

/** Independent syndrome: XOR the error bits on each plaquette. */
function syndrome(bits: number[], blocks: number[][]): number[] {
    return blocks.map((block) => block.reduce((sum, q) => sum + (bits[q] ?? 0), 0) % 2);
}

/** Independent minimum-weight decode by exhaustive enumeration. */
function decode(target: number[], blocks: number[][], n: number): { bits: number[]; weight: number } {
    const key = target.join("");
    let best = new Array<number>(n).fill(0);
    let bestWeight = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << n; mask += 1) {
        const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
        const weight = bits.reduce((s, b) => s + b, 0);
        if (weight < bestWeight && syndrome(bits, blocks).join("") === key) {
            best = bits;
            bestWeight = weight;
        }
    }
    return { bits: best, weight: bestWeight };
}

describe("Surface code error correction (small toy simulator)", () => {
    it("matches an independent syndrome and minimum-weight decoder", () => {
        const cases: Array<{ rows: number; cols: number; errors: number[] }> = [
            { rows: 3, cols: 3, errors: [4] },
            { rows: 3, cols: 3, errors: [0, 8] },
            { rows: 2, cols: 2, errors: [1, 2] },
            { rows: 2, cols: 3, errors: [0, 1, 5] },
        ];
        for (const testCase of cases) {
            const n = testCase.rows * testCase.cols;
            const blocks = plaquettes(testCase.rows, testCase.cols);
            const frames = [...mod.run(testCase)];
            checkFrames(frames, n, blocks.length);
            const meta = frames[frames.length - 1]?.meta;
            const errorBits = Array.from({ length: n }, (_, i) => (testCase.errors.includes(i) ? 1 : 0));

            const expectedSyndrome = syndrome(errorBits, blocks);
            const measured = frames[2]?.meta["syndrome"] as number[];
            expect(measured).toEqual(expectedSyndrome);

            const reference = decode(expectedSyndrome, blocks, n);
            expect(meta?.["correction"]).toEqual(reference.bits);
            expect(Number(meta?.["correctionWeight"])).toBe(reference.weight);
            expect(reference.weight).toBeLessThanOrEqual(testCase.errors.length);

            const cleared = frames[frames.length - 1]?.meta["syndrome"] as number[];
            expect(cleared.every((bit) => bit === 0)).toBe(true);
        }
    });

    it("always clears the syndrome for single errors", () => {
        for (const qubit of [0, 1, 4, 7, 8]) {
            const frames = [...mod.run({ rows: 3, cols: 3, errors: [qubit] })];
            checkFrames(frames, 9, 4);
            const cleared = frames[frames.length - 1]?.meta["syndrome"] as number[];
            expect(cleared).toEqual([0, 0, 0, 0]);
            expect(Number(frames[frames.length - 1]?.meta["residualWeight"])).toBe(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
