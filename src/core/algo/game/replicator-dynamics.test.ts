import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./replicator-dynamics";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function brute(payoffs: number[][], initial: number[], steps: number): number[][] {
    let x = initial.slice();
    const total = x.reduce((a, b) => a + b, 0);
    x = x.map((v) => v / total);
    const traj = [x.slice()];
    for (let g = 0; g < steps; g += 1) {
        const fit = x.map((_, i) => payoffs[i]!.reduce((s, p, j) => s + p * x[j]!, 0));
        const avg = x.reduce((s, f, i) => s + f * fit[i]!, 0);
        x = x.map((f, i) => (f * fit[i]!) / avg);
        const norm = x.reduce((a, b) => a + b, 0);
        x = x.map((v) => v / norm);
        traj.push(x.slice());
    }
    return traj;
}

describe("ReplicatorDynamics", () => {
    const cases = [
        { payoffs: [[3, 0], [5, 1]], initial: [0.5, 0.5], steps: 8 },
        {
            payoffs: [[1, 2, 3], [3, 1, 2], [2, 3, 1]],
            initial: [0.2, 0.3, 0.5],
            steps: 6,
        },
        { payoffs: [[2, 1], [1, 2]], initial: [0.9, 0.1], steps: 5 },
    ];

    it("matches an independent replicator iteration exactly", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = brute(input.payoffs, input.initial, input.steps);
            const got = (fs[fs.length - 1]?.meta.trajectory as string[]).map((row) => JSON.parse(row) as number[]);
            expect(got.length).toBe(expected.length);
            for (let g = 0; g < expected.length; g += 1) {
                for (let i = 0; i < input.payoffs.length; i += 1) {
                    expect(got[g]![i]).toBeCloseTo(expected[g]![i]!, 10);
                }
            }
        }
    });

    it("keeps frequencies normalized and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const traj = (fs[fs.length - 1]?.meta.trajectory as string[]).map((row) => JSON.parse(row) as number[]);
        for (const row of traj) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
