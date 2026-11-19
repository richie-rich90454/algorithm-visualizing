/**
 * repetition-code.test.ts - Brute-force syndrome/recovery check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./repetition-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.reduce((sum, a) => sum + a * a, 0)).toBeCloseTo(1, 10);
    });
}

/** Independent syndrome and majority-vote decoder built from the bit definitions. */
function expectedSyndrome(error: number): [number, number] {
    const bits = [0, 0, 0];
    if (error >= 0) {
        bits[error] = 1;
    }
    return [bits[0]! ^ bits[1]!, bits[1]! ^ bits[2]!];
}

function expectedCulprit(s0: number, s1: number): number {
    if (s0 === 1 && s1 === 0) return 0;
    if (s0 === 1 && s1 === 1) return 1;
    if (s0 === 0 && s1 === 1) return 2;
    return -1;
}

function flip(state: number[], q: number): number[] {
    if (q < 0) return [...state];
    const mask = 1 << (2 - q);
    const next = new Array<number>(8).fill(0);
    for (let i = 0; i < 8; i += 1) next[i ^ mask] = state[i] ?? 0;
    return next;
}

describe("RepetitionCode", () => {
    it("recovers the exact encoding for every single-qubit error", () => {
        for (const [a, b] of [[1, 0], [0, 1], [0.6, 0.8], [Math.SQRT1_2, Math.SQRT1_2]]) {
            for (const error of [-1, 0, 1, 2]) {
                const frames = [...mod.run({ a, b, error })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const syndrome = meta?.["syndrome"] as number[];
                const expected = expectedSyndrome(error);
                expect(syndrome[0]).toBe(expected[0]);
                expect(syndrome[1]).toBe(expected[1]);
                expect(meta?.["correctionQubit"]).toBe(expectedCulprit(expected[0], expected[1]));

                const norm = Math.hypot(a, b);
                const encoded = new Array<number>(8).fill(0);
                encoded[0] = a / norm;
                encoded[7] = b / norm;
                const errored = flip(encoded, error);
                const restored = flip(errored, expectedCulprit(expected[0], expected[1]));
                const finalAmps = meta?.["amplitudes"] as number[];
                for (let i = 0; i < 8; i += 1) {
                    expect(finalAmps[i]).toBeCloseTo(restored[i] ?? 0, 10);
                    expect(finalAmps[i]).toBeCloseTo(encoded[i] ?? 0, 10);
                }
                expect(meta?.["fidelity"]).toBeCloseTo(1, 10);
            }
        }
    });

    it("maps all four syndrome pairs to the correct action", () => {
        const seen = new Set<string>();
        for (const error of [-1, 0, 1, 2]) {
            const frames = [...mod.run({ error })];
            const meta = frames[4]?.meta;
            const syndrome = meta?.["syndrome"] as number[];
            seen.add(syndrome.join(""));
        }
        expect([...seen].sort()).toEqual(["00", "01", "10", "11"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
