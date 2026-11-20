import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./cfr";

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

describe("Cfr", () => {
    it("converges to the equilibrium found by backward induction", () => {
        // Player 2 prefers R after a0 (-1 > -3) and L after a1 (0 > -2).
        // Player 1 then prefers a0 (payoff 1 > 0).
        const u1 = [[3, 1], [0, 2]];
        const u2 = [[-3, -1], [0, -2]];
        const p2a = u2[0]?.[0]! >= u2[0]?.[1]! ? 0 : 1;
        const p2b = u2[1]?.[0]! >= u2[1]?.[1]! ? 0 : 1;
        const p1 = (u1[0]?.[p2a] ?? 0) >= (u1[1]?.[p2b] ?? 0) ? 0 : 1;

        const fs = frames({ iterations: 600 });
        shapes(fs);
        const last = fs[fs.length - 1];
        expect((last?.meta.avgI1 as number[])[p1]).toBeGreaterThan(0.85);
        expect((last?.meta.avgI2a as number[])[p2a]).toBeGreaterThan(0.85);
        expect((last?.meta.avgI2b as number[])[p2b]).toBeGreaterThan(0.85);
    });
    it("keeps valid strategies at every recorded iteration and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            for (const key of ["strategyI1", "strategyI2a", "strategyI2b", "avgI1", "avgI2a", "avgI2b"]) {
                const v = f.meta[key] as number[] | undefined;
                if (!v) continue;
                expect(v[0]! + v[1]!).toBeCloseTo(1, 6);
            }
        }
        expect(fs[fs.length - 1]?.meta.converged).toBe(true);
    });
});
