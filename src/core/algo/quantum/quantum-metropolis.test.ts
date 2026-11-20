/**
 * quantum-metropolis.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-metropolis";
import type { VisualFrame } from "@/types";

/** Independent classical Metropolis transition with the same symmetric proposal. */
function step(p: number[], energies: number[], beta: number): number[] {
    const n = p.length;
    const next = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const neighbors: number[] = [];
        if (i > 0) {
            neighbors.push(i - 1);
        }
        if (i + 1 < n) {
            neighbors.push(i + 1);
        }
        const proposalProb = neighbors.length > 0 ? 0.5 : 1;
        const selfLoop = neighbors.length === 0 ? (p[i] ?? 0) : neighbors.length === 1 ? (p[i] ?? 0) * 0.5 : 0;
        next[i] = (next[i] ?? 0) + selfLoop;
        for (const j of neighbors) {
            const delta = (energies[j] ?? 0) - (energies[i] ?? 0);
            const a = Math.min(1, Math.exp(-beta * delta));
            next[j] = (next[j] ?? 0) + (p[i] ?? 0) * proposalProb * a;
            next[i] = (next[i] ?? 0) + (p[i] ?? 0) * proposalProb * (1 - a);
        }
    }
    return next;
}

function gibbs(energies: number[], beta: number): number[] {
    const min = Math.min(...energies);
    const weights = energies.map((energy) => Math.exp(-beta * (energy - min)));
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((weight) => weight / sum);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
        const total = frame.entities.reduce((s, e) => s + Number(e.value), 0);
        expect(total).toBeCloseTo(1, 10);
    });
}

describe("Quantum Metropolis", () => {
    it("matches an independent Markov chain at every step", () => {
        const input = { energies: [0, 1, 2], beta: 1.5, start: 2, steps: 25 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);

        let p = [0, 0, 1];
        for (let t = 1; t <= 25; t += 1) {
            p = step(p, input.energies, input.beta);
            const actual = (frames[t]?.entities ?? []).map((e) => Number(e.value));
            actual.forEach((value, i) => {
                expect(value).toBeCloseTo(p[i] ?? 0, 10);
            });
        }
    });

    it("converges to the exact Gibbs distribution", () => {
        const energies = [0, 1, 2];
        const beta = 1.5;
        const frames = [...mod.run({ energies, beta, start: 2, steps: 200 })];
        checkFrames(frames, 3);
        const final = (frames[frames.length - 2]?.entities ?? []).map((e) => Number(e.value));
        const target = gibbs(energies, beta);
        final.forEach((value, i) => {
            expect(value).toBeCloseTo(target[i] ?? 0, 3);
        });
        const distance = Number(frames[frames.length - 1]?.meta["totalVariation"]);
        expect(distance).toBeLessThan(1e-3);
    });

    it("satisfies detailed balance against Boltzmann weights", () => {
        const energies = [0, 1, 2];
        const beta = 1.5;
        const pi = gibbs(energies, beta);
        for (let i = 0; i < energies.length; i += 1) {
            for (let j = 0; j < energies.length; j += 1) {
                if (Math.abs(i - j) !== 1) {
                    continue;
                }
                const a = Math.min(1, Math.exp(-beta * ((energies[j] ?? 0) - (energies[i] ?? 0))));
                const left = (pi[i] ?? 0) * 0.5 * a;
                const back = Math.min(1, Math.exp(-beta * ((energies[i] ?? 0) - (energies[j] ?? 0))));
                const right = (pi[j] ?? 0) * 0.5 * back;
                expect(left).toBeCloseTo(right, 12);
            }
        }
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
