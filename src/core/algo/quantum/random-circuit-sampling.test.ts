/**
 * random-circuit-sampling.test.ts - Independent Born probabilities, sampling statistics, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./random-circuit-sampling";
import type { VisualFrame } from "@/types";

interface Gate {
    type: "H" | "S" | "T" | "CNOT";
    q?: number;
    control?: number;
    target?: number;
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["gates"]).toBe("string");
    });
}

/** Independent complex state-vector simulation of a gate list. */
function referenceProbabilities(gates: Gate[], n: number): number[] {
    const dim = 1 << n;
    const re = new Array<number>(dim).fill(0);
    const im = new Array<number>(dim).fill(0);
    re[0] = 1;
    for (const gate of gates) {
        if (gate.type === "H" && gate.q !== undefined) {
            const bit = 1 << gate.q;
            for (let i = 0; i < dim; i += 1) {
                if ((i & bit) === 0) {
                    const j = i | bit;
                    const ar = re[i]!;
                    const ai = im[i]!;
                    const br = re[j]!;
                    const bi = im[j]!;
                    re[i] = (ar + br) * Math.SQRT1_2;
                    im[i] = (ai + bi) * Math.SQRT1_2;
                    re[j] = (ar - br) * Math.SQRT1_2;
                    im[j] = (ai - bi) * Math.SQRT1_2;
                }
            }
        } else if (gate.type === "S" && gate.q !== undefined) {
            const bit = 1 << gate.q;
            for (let i = 0; i < dim; i += 1) {
                if ((i & bit) !== 0) {
                    const r = re[i]!;
                    re[i] = -im[i]!;
                    im[i] = r;
                }
            }
        } else if (gate.type === "T" && gate.q !== undefined) {
            const bit = 1 << gate.q;
            const c = Math.SQRT1_2;
            for (let i = 0; i < dim; i += 1) {
                if ((i & bit) !== 0) {
                    const r = re[i]!;
                    const m = im[i]!;
                    re[i] = (r - m) * c;
                    im[i] = (r + m) * c;
                }
            }
        } else if (gate.type === "CNOT" && gate.control !== undefined && gate.target !== undefined) {
            const cb = 1 << gate.control;
            const tb = 1 << gate.target;
            for (let i = 0; i < dim; i += 1) {
                if ((i & cb) !== 0 && (i & tb) === 0) {
                    const j = i | tb;
                    [re[i], re[j]] = [re[j]!, re[i]!];
                    [im[i], im[j]] = [im[j]!, im[i]!];
                }
            }
        }
    }
    return re.map((r, i) => r * r + im[i]! * im[i]!);
}

describe("RandomCircuitSampling", () => {
    it("Born probabilities match an independent state-vector simulation", () => {
        for (const input of [
            { qubits: 2, depth: 2, samples: 100, seed: 7 },
            { qubits: 3, depth: 3, samples: 100, seed: 42 },
            { qubits: 4, depth: 2, samples: 100, seed: 99 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, 1 << input.qubits);
            const meta = frames[frames.length - 1]?.meta;
            const probs = meta?.["probabilities"] as number[];
            const expected = referenceProbabilities(JSON.parse(String(meta?.["gates"])) as Gate[], input.qubits);
            for (let i = 0; i < probs.length; i += 1) {
                expect(probs[i]!).toBeCloseTo(expected[i]!, 10);
            }
            expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        }
    });

    it("explicit known circuits give the correct distribution", () => {
        const single = [...mod.run({ qubits: 1, samples: 0, gates: [{ type: "H", q: 0 }] })];
        const singleProbs = single[1]?.meta["probabilities"] as number[];
        expect(singleProbs[0]).toBeCloseTo(0.5, 10);
        expect(singleProbs[1]).toBeCloseTo(0.5, 10);

        const bellGates: Gate[] = [{ type: "H", q: 0 }, { type: "CNOT", control: 0, target: 1 }];
        const bell = [...mod.run({ qubits: 2, samples: 0, gates: bellGates })];
        const bellProbs = bell[1]?.meta["probabilities"] as number[];
        expect(bellProbs[0]).toBeCloseTo(0.5, 10);
        expect(bellProbs[1]).toBeCloseTo(0, 10);
        expect(bellProbs[2]).toBeCloseTo(0, 10);
        expect(bellProbs[3]).toBeCloseTo(0.5, 10);
    });

    it("sampled frequencies converge to Born probabilities", () => {
        const frames = [...mod.run({ qubits: 3, depth: 2, samples: 10000, seed: 2024 })];
        const meta = frames[frames.length - 1]?.meta;
        const probs = meta?.["probabilities"] as number[];
        const freqs = meta?.["frequencies"] as number[];
        expect(freqs.reduce((a, b) => a + b, 0)).toBe(10000);
        for (let i = 0; i < probs.length; i += 1) {
            expect(Math.abs(freqs[i]! / 10000 - probs[i]!)).toBeLessThan(0.02);
        }
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ qubits: 3, depth: 2, samples: 500, seed: 5 })];
        const b = [...mod.run({ qubits: 3, depth: 2, samples: 500, seed: 5 })];
        expect(a[2]?.meta["frequencies"]).toEqual(b[2]?.meta["frequencies"]);
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
