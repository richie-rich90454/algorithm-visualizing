import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./alpha-zero-mcts";

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
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("tree");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
        f.edges.forEach((ed) => {
            expect(f.entities.some((e) => e.id === ed.sourceId)).toBe(true);
            expect(f.entities.some((e) => e.id === ed.targetId)).toBe(true);
        });
    });
}

describe("AlphaZeroMcts", () => {
    it("selects the action with the largest independently recomputed PUCT score", () => {
        for (const sims of [6, 12, 20]) {
            const fs = frames({ sims, c: 1.5, seed: 7 });
            shapes(fs);
            const probes = fs.filter((f) => Array.isArray(f.meta.scores));
            expect(probes.length).toBeGreaterThan(0);
            for (const f of probes) {
                const scores = f.meta.scores as number[];
                const q = f.meta.q as number[];
                const p = f.meta.p as number[];
                const nBefore = f.meta.nBefore as number[];
                const parentN = Number(f.meta.parentNBefore);
                const c = Number(f.meta.c);
                for (let i = 0; i < scores.length; i += 1) {
                    const expected = (q[i] ?? 0) + c * (p[i] ?? 0) * Math.sqrt(parentN) / (1 + (nBefore[i] ?? 0));
                    expect(scores[i]).toBeCloseTo(expected, 9);
                }
                let argmax = 0;
                for (let i = 1; i < scores.length; i += 1) {
                    if ((scores[i] ?? 0) > (scores[argmax] ?? 0)) argmax = i;
                }
                expect(f.meta.chosen).toBe(argmax);
            }
        }
    });
    it("spends exactly the simulation budget and recommends the most-visited move", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const visits = last?.meta.visits as number[];
        expect(visits.reduce((a, b) => a + b, 0)).toBe(12);
        let best = 0;
        for (let i = 1; i < visits.length; i += 1) if ((visits[i] ?? 0) > (visits[best] ?? 0)) best = i;
        expect(last?.meta.best).toBe(["A", "B", "C", "D"][best]);
        expect(last?.meta.totalVisits).toBe(12);
    });
});
