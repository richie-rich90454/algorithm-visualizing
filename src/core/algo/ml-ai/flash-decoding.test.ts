/**
 * flash-decoding.test.ts - Split-KV merge correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./flash-decoding";
import type { VisualFrame } from "@/types";

/** Full softmax attention computed directly over every key, with no blocks. */
function reference(query: number[], keys: number[][], values: number[][]) {
    const scale = Math.sqrt(query.length);
    const scores = keys.map((key) => key.reduce((sum, v, i) => sum + v * (query[i] ?? 0), 0) / scale);
    const max = Math.max(...scores);
    const exps = scores.map((score) => Math.exp(score - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    const dv = values[0]?.length ?? 1;
    const out: number[] = [];
    for (let k = 0; k < dv; k += 1) {
        let acc = 0;
        for (let j = 0; j < keys.length; j += 1) {
            acc += ((exps[j] ?? 0) / total) * (values[j]?.[k] ?? 0);
        }
        out.push(acc);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], keys: number): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(6 * keys);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FlashDecoding", () => {
    it("matches full attention for several block sizes", () => {
        const input = mod.defaultInput as {
            query: number[];
            keys: number[][];
            values: number[][];
        };
        const expected = reference(input.query, input.keys, input.values);
        for (const blockSize of [1, 2, 3, 6, 10]) {
            const frames = [...mod.run({ ...input, blockSize })];
            checkFrames(frames, input.keys.length);
            const merged = (frames[frames.length - 1]?.meta["mergedOutput"] as string[]).map(Number);
            expect(merged.length).toBe(expected.length);
            expected.forEach((value, k) => {
                expect(merged[k] ?? 0).toBeCloseTo(value, 2);
            });
        }
    });

    it("handles a single key and a value dimension of one", () => {
        const frames = [
            ...mod.run({ query: [1, 0], keys: [[2, 1]], values: [[5]], blockSize: 1 }),
        ];
        checkFrames(frames, 1);
        const merged = (frames[frames.length - 1]?.meta["mergedOutput"] as string[]).map(Number);
        expect(merged[0]).toBeCloseTo(5, 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
