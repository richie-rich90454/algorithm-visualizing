/**
 * quantum-decision-tree.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-decision-tree";
import type { VisualFrame } from "@/types";

/** Independent matrix-power simulation of the Grover iterate. */
function matrixOracle(leaves: number[], iterations: number): number[] {
    const n = leaves.length;
    const uniform = Array.from({ length: n }, () => 1 / Math.sqrt(n));
    let state = [...uniform];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        // Oracle O: diagonal matrix flipping accepting leaves.
        state = state.map((value, index) => (leaves[index] === 1 ? -value : value));
        // Diffusion D = 2 u u^T - I applied as a matrix-vector product.
        const mean = state.reduce((sum, value) => sum + value, 0) / n;
        state = state.map((value) => 2 * mean - value);
    }
    void uniform;
    return state;
}

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Quantum Decision Tree Search", () => {
    it("concentrates amplitude on an accepting leaf", () => {
        const leaves = [0, 0, 1, 0];
        const frames = [...mod.run({ leaves })];
        checkFrames(frames, leaves.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const selected = last?.["selected"] as number;
        expect(leaves[selected]).toBe(1);
        const firstSuccess = frames[0]?.meta["success"] as number;
        expect(last?.["success"] as number).toBeGreaterThan(firstSuccess);
        expect(last?.["path"] as string[]).toHaveLength(2);
    });

    it("matches an independent matrix-power oracle simulation", () => {
        for (const leaves of [[0, 1, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 1, 0, 0, 0]]) {
            const frames = [...mod.run({ leaves })];
            const last = frames[frames.length - 1]?.meta;
            const expected = matrixOracle(leaves, last?.["iterations"] as number);
            const actual = last?.["amplitudes"] as number[];
            for (let index = 0; index < leaves.length; index += 1) {
                expect(actual[index]).toBeCloseTo(expected[index] as number, 10);
            }
        }
    });

    it("handles a tree with no accepting leaf", () => {
        const frames = [...mod.run({ leaves: [0, 0, 0, 0] })];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["selected"]).toBe(-1);
        expect(last?.["success"]).toBe(0);
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
