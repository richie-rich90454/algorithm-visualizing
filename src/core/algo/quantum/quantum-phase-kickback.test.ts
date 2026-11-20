/**
 * quantum-phase-kickback.test.ts - Independent matrix simulation cross-check,
 * eigenstate and probability properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-phase-kickback";
import type { VisualFrame } from "@/types";

type C = [number, number];

const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const s = Math.SQRT1_2;

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(8);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 + amps[i + 1]! ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
}

function toPairs(flat: number[]): C[] {
    return Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);
}

describe("QuantumPhaseKickback", () => {
    it("matches an independently applied controlled-phase and Hadamard circuit", () => {
        for (const theta of [0, 0.6, 1.2, Math.PI]) {
            const frames = [...mod.run({ theta })];
            checkFrames(frames);
            let state: C[] = [[0, 0], [s, 0], [0, 0], [s, 0]];
            state[3] = cMul(state[3]!, [Math.cos(theta), Math.sin(theta)]);
            const next: C[] = state.map((z) => [...z] as C);
            for (const offset of [0, 1]) {
                const a = state[offset]!;
                const b = state[offset + 2]!;
                next[offset] = [(a[0] + b[0]) * s, (a[1] + b[1]) * s];
                next[offset + 2] = [(a[0] - b[0]) * s, (a[1] - b[1]) * s];
            }
            const final = toPairs(frames[frames.length - 1]!.meta["amplitudes"] as number[]);
            for (let i = 0; i < 4; i += 1) {
                expect(final[i]![0]).toBeCloseTo(next[i]![0], 11);
                expect(final[i]![1]).toBeCloseTo(next[i]![1], 11);
            }
        }
    });

    it("keeps the target in |1> and places exactly theta on the control phase", () => {
        const theta = 1.1;
        const frames = [...mod.run({ theta })];
        checkFrames(frames);
        const before = toPairs(frames[2]!.meta["amplitudes"] as number[]);
        const phase = Math.atan2(before[3]![1], before[3]![0]) - Math.atan2(before[1]![1], before[1]![0]);
        expect(phase).toBeCloseTo(theta, 11);
        const final = frames[frames.length - 1]!;
        expect(final.meta["targetProb1"]).toBeCloseTo(1, 11);
        expect(final.meta["controlProb0"]).toBeCloseTo((1 + Math.cos(theta)) / 2, 11);
        expect(final.meta["thetaRecovered"]).toBeCloseTo(theta, 10);
    });

    it("clamps theta into the supported interval", () => {
        const frames = [...mod.run({ theta: 99 })];
        expect(frames[0]!.meta["theta"]).toBeCloseTo(Math.PI, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
