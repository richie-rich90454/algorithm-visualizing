/**
 * dora.test.ts - Independent decomposition and recombination, column-norm
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dora";
import type { VisualFrame } from "@/types";

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function reference(weight: number[][], rank: number, seed: number) {
    const dOut = weight.length;
    const dIn = weight[0]?.length ?? 0;
    const next = weightStream(seed);
    const magnitude = Array.from({ length: dIn }, (_u, c) =>
        Math.sqrt(weight.reduce((s, row) => s + (row[c] ?? 0) ** 2, 0)) || 1,
    );
    const direction = weight.map((row) => row.map((v, c) => v / (magnitude[c] ?? 1)));
    const A = Array.from({ length: rank }, () => Array.from({ length: dIn }, next));
    const B = Array.from({ length: dOut }, () => Array.from({ length: rank }, next));
    const deltaM = Array.from({ length: dIn }, next);
    const deltaV = Array.from({ length: dOut }, (_u, r) =>
        Array.from({ length: dIn }, (_v, c) => (B[r] ?? []).reduce((s, b, k) => s + b * (A[k]?.[c] ?? 0), 0)),
    );
    const updated = direction.map((row, r) => row.map((v, c) => v + (deltaV[r]?.[c] ?? 0)));
    const finalWeight = updated.map((row) =>
        row.map((v, c) => {
            const norm = Math.sqrt(updated.reduce((s, rr) => s + (rr[c] ?? 0) ** 2, 0)) || 1;
            return ((magnitude[c] ?? 0) + (deltaM[c] ?? 0)) * (v / norm);
        }),
    );
    const columnNorms = Array.from({ length: dIn }, (_u, c) =>
        Math.sqrt(finalWeight.reduce((s, row) => s + (row[c] ?? 0) ** 2, 0)),
    );
    return { magnitude, direction, deltaM, deltaV, finalWeight, columnNorms };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

describe("DoRA", () => {
    const weight = [
        [3, 0, 1],
        [0, 4, 2],
        [1, 2, 5],
    ];

    it("reproduces an independent decomposition and recombination", () => {
        const input = { weight, rank: 1, seed: 5 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3, 3);
        const expected = reference(weight, 1, 5);
        const final = frames[frames.length - 1];
        const gotMagnitude = final?.meta["magnitude"] as number[];
        const gotDirection = final?.meta["direction"] as number[];
        const gotDeltaM = final?.meta["deltaM"] as number[];
        const gotDeltaV = final?.meta["deltaV"] as number[];
        const gotFinal = final?.meta["finalWeight"] as number[];
        const gotNorms = final?.meta["columnNorms"] as number[];
        gotMagnitude.forEach((v, i) => expect(v).toBeCloseTo(expected.magnitude[i] ?? 0, 9));
        gotDirection.forEach((v, i) => expect(v).toBeCloseTo(expected.direction.flat()[i] ?? 0, 9));
        gotDeltaM.forEach((v, i) => expect(v).toBeCloseTo(expected.deltaM[i] ?? 0, 9));
        gotDeltaV.forEach((v, i) => expect(v).toBeCloseTo(expected.deltaV.flat()[i] ?? 0, 9));
        gotFinal.forEach((v, i) => expect(v).toBeCloseTo(expected.finalWeight.flat()[i] ?? 0, 9));
        gotNorms.forEach((v, i) => expect(v).toBeCloseTo(expected.columnNorms[i] ?? 0, 9));
    });

    it("keeps every recomposed column norm equal to its updated magnitude", () => {
        for (const seed of [1, 5, 42]) {
            for (const rank of [1, 2]) {
                const frames = [...mod.run({ weight, rank, seed })];
                const final = frames[frames.length - 1];
                const norms = final?.meta["columnNorms"] as number[];
                const magnitude = final?.meta["magnitude"] as number[];
                const deltaM = final?.meta["deltaM"] as number[];
                const expectedNew = reference(weight, rank, seed).finalWeight;
                norms.forEach((norm, c) => {
                    expect(norm).toBeCloseTo((magnitude[c] ?? 0) + (deltaM[c] ?? 0), 9);
                    const recomputed = Math.sqrt(expectedNew.reduce((s, row) => s + (row[c] ?? 0) ** 2, 0));
                    expect(recomputed).toBeCloseTo(norm, 9);
                });
            }
        }
    });

    it("reconstructs the original weight from magnitude times direction with no update", () => {
        const referenceResult = reference(weight, 1, 5);
        weight.forEach((row, r) => {
            row.forEach((value, c) => {
                const rebuilt = (referenceResult.magnitude[c] ?? 0) * (referenceResult.direction[r]?.[c] ?? 0);
                expect(rebuilt).toBeCloseTo(value, 9);
            });
        });
        const fromModule = [...mod.run({ weight, rank: 1, seed: 5 })];
        const dir = fromModule[0]?.meta["direction"] as number[];
        const mag = fromModule[0]?.meta["magnitude"] as number[];
        weight.forEach((row, r) => {
            row.forEach((value, c) => {
                expect((mag[c] ?? 0) * (dir[r * 3 + c] ?? 0)).toBeCloseTo(value, 9);
            });
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
