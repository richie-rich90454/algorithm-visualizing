/**
 * paged-attention.test.ts - Gathering correctness against dense attention, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { gatherLogical, pagedAttentionCompute, softmax } from "./paged-attention";
import type { VisualFrame } from "@/types";

type Input = { queries: number[][]; keys: number[][]; values: number[][]; blockSize: number };

/** Independent dense attention used as the reference. */
function reference(Q: number[][], K: number[][], V: number[][]) {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    const out: number[][] = [];
    for (const q of Q) {
        const scores = K.map((k) => k.reduce((s, v, j) => s + (q[j] ?? 0) * v, 0) / scale);
        const max = Math.max(...scores);
        const exps = scores.map((s) => Math.exp(s - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        const w = exps.map((e) => e / sum);
        const dim = V[0]?.length ?? 0;
        out.push(
            Array.from({ length: dim }, (_, j) => V.reduce((s, row, i) => s + (w[i] ?? 0) * (row[j] ?? 0), 0)),
        );
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number")).toBe(true);
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("PagedAttention", () => {
    it("gathers logical rows through the block table exactly", () => {
        const physical = [[1, 1], [9, 9], [2, 2], [0, 0]];
        const table = [1, 0];
        const gathered = gatherLogical(physical, table, 2, 3);
        expect(gathered).toEqual([[2, 2], [0, 0], [1, 1]]);
        expect(softmax([1, 2, 3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("matches dense attention regardless of block size or permutation", () => {
        const cases: Input[] = [
            {
                queries: [[1, 0], [0, 1]],
                keys: [[1, 0], [0, 1], [0.5, 0.5]],
                values: [[2, 0], [0, 3], [1, 1]],
                blockSize: 2,
            },
            {
                queries: [[0.3, -0.7], [1.2, 0.4], [-1, 1]],
                keys: [[1, 0.2], [-0.5, 1], [0.7, 0.7], [0, -1], [2, 0.1]],
                values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
                blockSize: 2,
            },
            {
                queries: [[1, 2, 0.5]],
                keys: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]],
                values: [[1, 0], [0, 1], [1, 1], [2, 2]],
                blockSize: 3,
            },
        ];
        for (const input of cases) {
            const expected = reference(input.queries, input.keys, input.values);
            const expectedFlat = expected.reduce<number[]>((acc, row) => acc.concat(row), []);
            const meta = finalMeta(input);
            const output = meta["output"] as number[];
            expect(output).toHaveLength(expectedFlat.length);
            for (let i = 0; i < expectedFlat.length; i += 1) {
                expect(output[i] ?? 0).toBeCloseTo(expectedFlat[i] ?? 0, 9);
            }
            const gathered = meta["gathered"] as number[];
            const keyFlat = input.keys.reduce<number[]>((acc, row) => acc.concat(row), []);
            expect(gathered).toEqual(keyFlat);
            const table = meta["table"] as number[];
            expect([...table].sort((a, b) => a - b)).toEqual(table.map((_, i) => i));
        }
    });

    it("exposes the same result through the pure compute helper", () => {
        const input = mod.defaultInput as Input;
        const blocks = Math.ceil(input.keys.length / input.blockSize);
        const table = Array.from({ length: blocks }, (_, i) => (i + 1) % blocks);
        const pk: number[][] = Array.from({ length: blocks * input.blockSize }, () => []);
        const pv: number[][] = Array.from({ length: blocks * input.blockSize }, () => []);
        input.keys.forEach((row, r) => {
            const slot = (table[Math.floor(r / input.blockSize)] ?? 0) * input.blockSize + (r % input.blockSize);
            pk[slot] = row;
        });
        input.values.forEach((row, r) => {
            const slot = (table[Math.floor(r / input.blockSize)] ?? 0) * input.blockSize + (r % input.blockSize);
            pv[slot] = row;
        });
        const direct = pagedAttentionCompute(input.queries, pk, pv, table, input.blockSize, input.keys.length);
        expect(direct.keys).toEqual(input.keys);
        const ref = reference(input.queries, input.keys, input.values);
        direct.output.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(ref[i]?.[j] ?? 0, 9)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
