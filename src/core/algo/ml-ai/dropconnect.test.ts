/** dropconnect.test.ts - Independent mask replication, scaled output, unbiased expectation, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./dropconnect";
import type { VisualFrame } from "@/types";

interface Input {
    weights: number[][];
    inputVector: number[];
    keepProb: number;
    seed: number;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["size"]).toBe(cells);
    });
}

/** Replicate the linear-congruential mask without importing the helper. */
function independentMask(seed: number, size: number, p: number): number[] {
    let state = (seed >>> 0) || 1;
    return Array.from({ length: size }, () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296 < p ? 1 : 0;
    });
}

describe("DropConnect", () => {
    const input = mod.defaultInput as Input;
    const cellCount = input.weights.length * (input.weights[0]?.length ?? 0);

    it("matches an independent mask and recomputes every output", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.weights.length + 2);
        checkFrames(frames, cellCount);
        const meta = frames.at(-1)!.meta;
        const mask = independentMask(input.seed, cellCount, input.keepProb);
        expect(meta["mask"]).toEqual(mask);
        expect(Number(meta["kept"])).toBe(mask.reduce((s, v) => s + v, 0));
        const cols = input.weights[0]!.length;
        const output = meta["output"] as number[];
        input.weights.forEach((row, r) => {
            let expected = 0;
            for (let cIdx = 0; cIdx < cols; cIdx += 1) {
                expected += row[cIdx]! * mask[r * cols + cIdx]! * input.inputVector[cIdx]!;
            }
            expect(output[r]!).toBeCloseTo(expected / input.keepProb, 10);
        });
    });

    it("keeps the expected output unbiased across many seeds", () => {
        const sums = input.weights.map(() => 0);
        const trials = 1000;
        for (let seed = 1; seed <= trials; seed += 1) {
            const spreadSeed = (seed * 2654435761) >>> 0;
            const meta = [...mod.run({ ...input, seed: spreadSeed })].at(-1)!.meta;
            (meta["output"] as number[]).forEach((value, i) => {
                sums[i] += value;
            });
        }
        const expected = [...mod.run(input)].at(-1)!.meta["expectedOutput"] as number[];
        sums.forEach((sum, i) => {
            expect(sum / trials).toBeCloseTo(expected[i]!, 1);
        });
    });

    it("keeps every mask entry binary and the kept count in range", () => {
        const meta = [...mod.run(input)].at(-1)!.meta;
        const mask = meta["mask"] as number[];
        mask.forEach((v) => expect(v === 0 || v === 1).toBe(true));
        expect(Number(meta["kept"])).toBeGreaterThanOrEqual(0);
        expect(Number(meta["kept"])).toBeLessThanOrEqual(cellCount);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.weights.length + 2);
        expect(generator.next().done).toBe(true);
    });
});
