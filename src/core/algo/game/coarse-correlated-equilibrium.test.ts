/**
 * coarse-correlated-equilibrium.test.ts - Regret property, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./coarse-correlated-equilibrium";
import type { VisualFrame } from "@/types";

function swapGain(payoff: number[][], dist: number[], n: number, m: number, rowPlayer: boolean): number {
    let worst = -Infinity;
    if (rowPlayer) {
        for (let i = 0; i < n; i += 1) {
            for (let alt = 0; alt < n; alt += 1) {
                let gain = 0;
                for (let j = 0; j < m; j += 1) {
                    gain += (dist[i * m + j] ?? 0) * ((payoff[alt]?.[j] ?? 0) - (payoff[i]?.[j] ?? 0));
                }
                worst = Math.max(worst, gain);
            }
        }
    } else {
        for (let j = 0; j < m; j += 1) {
            for (let alt = 0; alt < m; alt += 1) {
                let gain = 0;
                for (let i = 0; i < n; i += 1) {
                    gain += (dist[i * m + j] ?? 0) * ((payoff[i]?.[alt] ?? 0) - (payoff[i]?.[j] ?? 0));
                }
                worst = Math.max(worst, gain);
            }
        }
    }
    return worst;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.entities.length).toBe(4);
        for (const e of frame.entities) expect(e.type).toBe("cell");
    });
}

describe("Coarse correlated equilibrium", () => {
    it("converges to a distribution with no profitable fixed-action swap", () => {
        let seed = 99;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x80000000;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const payoffA = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => Math.floor(rand() * 7) - 3));
            const payoffB = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => Math.floor(rand() * 7) - 3));
            const frames = [...mod.run({ payoffA, payoffB, iterations: 30000, seed: trial + 1 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const dist = final?.meta["distribution"] as number[];
            expect(dist.length).toBe(4);
            expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
            for (const p of dist) expect(p).toBeGreaterThanOrEqual(-1e-12);
            const worst = Math.max(
                swapGain(payoffA, dist, 2, 2, true),
                swapGain(payoffB, dist, 2, 2, false),
            );
            expect(worst).toBeLessThan(0.15);
        }
    });

    it("puts mass on the diagonal in a pure coordination game", () => {
        const payoffA = [[2, -1], [-1, 2]];
        const payoffB = [[2, -1], [-1, 2]];
        const frames = [...mod.run({ payoffA, payoffB, iterations: 30000, seed: 7 })];
        const dist = frames[frames.length - 1]?.meta["distribution"] as number[];
        expect((dist[0] as number) + (dist[3] as number)).toBeGreaterThan(0.85);
        expect((dist[1] as number) + (dist[2] as number)).toBeLessThan(0.15);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
