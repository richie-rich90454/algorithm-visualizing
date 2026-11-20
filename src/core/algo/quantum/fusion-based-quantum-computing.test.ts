/**
 * fusion-based-quantum-computing.test.ts - Fused graph-state fidelity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fusion-based-quantum-computing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["count"]));
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Build a graph state with real amplitudes for a given edge list. */
function graphState(qubits: number, edges: number[][]): number[] {
    const dimension = 1 << qubits;
    const state = Array.from({ length: dimension }, () => 1 / Math.sqrt(dimension));
    for (const [a, b] of edges) {
        for (let index = 0; index < dimension; index += 1) {
            if (((index >> (a ?? 0)) & 1) === 1 && ((index >> (b ?? 0)) & 1) === 1) {
                state[index] = -(state[index] ?? 0);
            }
        }
    }
    return state;
}

describe("Fusion-Based Quantum Computing", () => {
    it("fuses two graph states into the target graph state", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["fidelity"])).toBeCloseTo(1, 10);
        const amplitudes = final["amplitudes"] as number[];
        const target = graphState(2, [[0, 1]]);
        const overlap = Math.abs(amplitudes.reduce((sum, value, index) => sum + value * (target[index] ?? 0), 0));
        expect(overlap).toBeCloseTo(1, 10);
        expect(amplitudes.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(1, 10);
    });

    it("builds the initial resources independently", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        const resources = graphState(4, [[0, 1], [2, 3]]);
        const bars = frames[1]!.entities;
        bars.forEach((bar, index) => {
            expect(Number(bar.value)).toBeCloseTo((resources[index] ?? 0) ** 2, 10);
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
