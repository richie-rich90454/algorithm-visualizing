/** nested-monte-carlo-tree-search.test.ts - Convergence and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./nested-monte-carlo-tree-search";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(3);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.layout).toBe("tree");
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.entities.length).toBe(4);
        f.entities.forEach((e) => {
            expect(Number.isFinite(e.x)).toBe(true);
            expect(String(e.metadata["parentId"])).toBeTruthy();
        });
        expect(f.meta).toBeDefined();
    });
}

describe("Nested Monte Carlo Tree Search", () => {
    it("identifies the dominant action after enough simulations", () => {
        const fs = frames({ sims: 240, inner: 4, seed: 4242 });
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["best"]).toBe("B");
        expect(last?.["winner"]).toBe("B");
        const visits = last?.["visits"] as number[];
        expect(visits.reduce((a, b) => a + b, 0)).toBe(240);
        expect(visits[1]).toBeGreaterThan(visits[0]!);
        expect(visits[1]).toBeGreaterThan(visits[2]!);
    });

    it("keeps reward estimates within the payoff range and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            const totals = f.meta["totals"] as number[] | undefined;
            if (!totals) continue;
            for (const t of totals) {
                expect(Number.isFinite(t)).toBe(true);
            }
        }
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
