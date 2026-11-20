/**
 * gru.test.ts - Independent GRU equation replay, bounds, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { GRU_PARAMS, gruStep } from "./gru";
import type { VisualFrame } from "@/types";

type Input = { h0: number[]; sequence: number[][] };

const sigmoid = (v: number): number => 1 / (1 + Math.exp(-v));

/** Brute-force replay of the GRU equations using the published matrices. */
function reference(h0: number[], sequence: number[][]) {
    let h = h0.slice();
    const trajectory = [h.slice()];
    const zList: number[][] = [];
    const rList: number[][] = [];
    for (const x of sequence) {
        const concat = [...h, ...x];
        const z = GRU_PARAMS.Wz.map((row, i) => sigmoid(row.reduce((s, w, j) => s + w * (concat[j] ?? 0), 0) + GRU_PARAMS.bz[i]!));
        const r = GRU_PARAMS.Wr.map((row, i) => sigmoid(row.reduce((s, w, j) => s + w * (concat[j] ?? 0), 0) + GRU_PARAMS.br[i]!));
        const reset = h.map((v, i) => v * r[i]!);
        const candInput = [...reset, ...x];
        const tilde = GRU_PARAMS.Wh.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * (candInput[j] ?? 0), 0) + GRU_PARAMS.bh[i]!));
        h = h.map((v, i) => (1 - z[i]!) * v + z[i]! * tilde[i]!);
        trajectory.push(h.slice());
        zList.push(z);
        rList.push(r);
    }
    return { trajectory: trajectory.flat(), gates: zList.flat(), resets: rList.flat(), final: h };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("GRU cell step", () => {
    it("matches an independent replay of gates and hidden states", () => {
        const cases: Input[] = [
            { h0: [0, 0], sequence: [[1, 0], [0, 1], [-1, 0.5]] },
            { h0: [0.5, -0.5], sequence: [[2, -1], [-0.3, 0.7]] },
            { h0: [-1, 1], sequence: [[0, 0], [1, 1], [1, 1], [-2, 0.5]] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input.h0, input.sequence);
            const final = frames[frames.length - 1]?.meta ?? {};
            (final["trajectory"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.trajectory[i] ?? 0, 9));
            (final["gates"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.gates[i] ?? 0, 9));
            (final["resets"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.resets[i] ?? 0, 9));
            const lastState = (final["trajectory"] as number[]).slice(-2);
            expected.final.forEach((v, i) => expect(lastState[i] ?? 0).toBeCloseTo(v, 9));
        }
    });

    it("keeps gates in (0,1) and hidden states in [-1,1]", () => {
        const step = gruStep([0.5, -0.5], [1, -1]);
        expect(step.z.every((v) => v > 0 && v < 1)).toBe(true);
        expect(step.r.every((v) => v > 0 && v < 1)).toBe(true);
        expect(step.hTilde.every((v) => v >= -1 && v <= 1)).toBe(true);
        const frames = [...mod.run(mod.defaultInput)];
        const trajectory = frames[frames.length - 1]?.meta["trajectory"] as number[];
        expect(trajectory.every((v) => v >= -1 && v <= 1)).toBe(true);
    });

    it("holds the state when input and state are near zero update weight", () => {
        const step = gruStep([0, 0], [0, 0]);
        expect(step.h.every((v) => Number.isFinite(v))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
