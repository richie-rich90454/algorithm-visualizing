/**
 * grover-search.test.ts - Independent amplitude reference, norm, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./grover-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent ideal Grover amplitude evolution. */
function reference(n: number, marked: number, iterations: number): number[] {
    const amps = Array.from({ length: n }, () => 1 / Math.sqrt(n));
    for (let k = 0; k < iterations; k += 1) {
        amps[marked] = -(amps[marked] ?? 0);
        const mean = amps.reduce((s, a) => s + a, 0) / n;
        for (let i = 0; i < n; i += 1) {
            amps[i] = 2 * mean - (amps[i] ?? 0);
        }
    }
    return amps;
}

describe("Grover search (ideal small simulator)", () => {
    it("matches an independent state-vector reference", () => {
        for (const qubits of [1, 2, 3, 4]) {
            const n = 1 << qubits;
            const marked = n - 1;
            const iterations = Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(n)));
            const frames = [...mod.run({ qubits, marked })];
            checkFrames(frames, n);
            const want = reference(n, marked, iterations);
            const got = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            for (let i = 0; i < n; i += 1) {
                expect(got[i]).toBeCloseTo(want[i]!, 12);
            }
            expect(frames[0]?.meta["iterations"]).toBe(iterations);
        }
    });

    it("preserves probability and amplifies every marked state", () => {
        for (const qubits of [2, 3, 4]) {
            const n = 1 << qubits;
            for (const marked of [0, 1, n - 1]) {
                const frames = [...mod.run({ qubits, marked })];
                checkFrames(frames, n);
                for (const frame of frames) {
                    const amps = frame.meta["amplitudes"] as number[];
                    const norm = amps.reduce((s, a) => s + a * a, 0);
                    expect(norm).toBeCloseTo(1, 11);
                }
                const last = frames[frames.length - 1]?.meta;
                const markedProb = Number(last?.["markedProbability"]);
                const probabilities = last?.["probabilities"] as number[];
                expect(markedProb).toBe(Math.max(...probabilities));
                expect(markedProb).toBeGreaterThan(0.5);
                expect(probabilities.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 11);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
