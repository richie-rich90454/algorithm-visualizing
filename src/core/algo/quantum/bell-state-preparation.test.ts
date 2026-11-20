/**
 * bell-state-preparation.test.ts - Explicit matrix reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bell-state-preparation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Apply two-qubit gates with explicit 4 by 4 matrices. */
function reference(initial: string): number[] {
    const s = 1 / Math.sqrt(2);
    const h0 = [
        [s, 0, s, 0],
        [0, s, 0, s],
        [s, 0, -s, 0],
        [0, s, 0, -s],
    ];
    const cnot = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1],
        [0, 0, 1, 0],
    ];
    const input = [0, 0, 0, 0];
    input[Number.parseInt(initial, 2)] = 1;
    const afterHadamard = h0.map((row) =>
        row.reduce((sum, entry, j) => sum + entry * input[j]!, 0),
    );
    return cnot.map((row) =>
        row.reduce((sum, entry, j) => sum + entry * afterHadamard[j]!, 0),
    );
}

describe("BellStatePreparation", () => {
    it("matches an explicit four-by-four matrix circuit for all inputs", () => {
        for (const initial of ["00", "01", "10", "11"]) {
            const frames = [...mod.run({ initial })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            const expected = reference(initial);
            for (let i = 0; i < 4; i += 1) {
                expect(final[i]).toBeCloseTo(expected[i]!, 12);
            }
        }
    });

    it("prepares the Phi plus state from |00> and preserves probability", () => {
        const frames = [...mod.run({ initial: "00" })];
        checkFrames(frames);
        const s = 1 / Math.sqrt(2);
        const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(final[0]).toBeCloseTo(s, 12);
        expect(final[1]).toBeCloseTo(0, 12);
        expect(final[2]).toBeCloseTo(0, 12);
        expect(final[3]).toBeCloseTo(s, 12);
        for (const frame of frames) {
            const amplitudes = frame.meta["amplitudes"] as number[];
            expect(amplitudes.reduce((total, a) => total + a * a, 0)).toBeCloseTo(1, 12);
        }
    });

    it("rejects malformed input by using the default basis state", () => {
        const frames = [...mod.run({ initial: "2x" })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(final[0]).toBeCloseTo(1 / Math.sqrt(2), 12);
        expect(final[3]).toBeCloseTo(1 / Math.sqrt(2), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
