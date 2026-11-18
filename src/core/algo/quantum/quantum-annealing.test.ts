/**
 * quantum-annealing.test.ts - Brute-force ground-state check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-annealing";
import type { VisualFrame } from "@/types";

type Coupling = [number, number, number];

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Brute-force classical Ising minimum and all minimizers. */
function bruteForce(n: number, h: number[], couplings: Coupling[]) {
    const N = 1 << n;
    const z = (x: number, q: number) => (((x >> (n - 1 - q)) & 1) === 0 ? 1 : -1);
    const energies = Array.from({ length: N }, (_, x) => {
        let e = 0;
        for (let q = 0; q < n; q += 1) e += (h[q] ?? 0) * z(x, q);
        for (const [i, j, jij] of couplings) e += jij * z(x, i) * z(x, j);
        return e;
    });
    const min = Math.min(...energies);
    return { min, argmins: energies.map((e, x) => (e === min ? x : -1)).filter((x) => x >= 0) };
}

describe("Quantum Annealing", () => {
    it("lands on a brute-force ground state with high probability", () => {
        const cases: Array<{ n: number; h: number[]; couplings: Coupling[] }> = [
            { n: 2, h: [0.8, -0.5], couplings: [[0, 1, 1]] },
            { n: 2, h: [0, 0], couplings: [[0, 1, 1]] },
            { n: 3, h: [0.4, -0.6, 0.9], couplings: [[0, 1, 1], [1, 2, -0.8]] },
        ];
        for (const c of cases) {
            const frames = [...mod.run({ ...c, steps: 1000, totalTime: 100 })];
            checkFrames(frames, 1 << c.n);
            const meta = frames[frames.length - 1]!.meta;
            const optimum = bruteForce(c.n, c.h, c.couplings);
            expect(Number(meta["groundEnergy"])).toBeCloseTo(optimum.min, 8);
            expect(optimum.argmins).toContain(Number(meta["ground"]));
            const probabilities = meta["probabilities"] as number[] | undefined;
            const massOnOptima = probabilities
                ? optimum.argmins.reduce((sum, x) => sum + (probabilities[x] ?? 0), 0)
                : Number(meta["groundProb"]);
            expect(massOnOptima).toBeGreaterThan(0.9);
            expect(Number(meta["probSum"])).toBeCloseTo(1, 6);
        }
    });

    it("lowers the energy expectation compared with the initial uniform state", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const initial = Number(frames[0]!.meta["energy"]);
        const final = Number(frames[frames.length - 1]!.meta["energy"]);
        expect(final).toBeLessThan(initial);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
