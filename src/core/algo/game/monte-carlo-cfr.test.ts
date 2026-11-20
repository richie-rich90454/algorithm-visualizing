/** monte-carlo-cfr.test.ts - Regret convergence and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./monte-carlo-cfr";

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
        expect(f.entities.every((e) => Number.isFinite(e.x))).toBe(true);
        expect(f.meta).toBeDefined();
    });
}

describe("Monte Carlo CFR", () => {
    it("converges the average strategy to the best expected payoff action", () => {
        const fs = frames({ iterations: 900, seed: 99, epsilon: 0.15 });
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["best"]).toBe("B");
        const strategy = last?.["strategy"] as number[];
        expect(strategy[1]!).toBeGreaterThan(strategy[0]!);
        expect(strategy[1]!).toBeGreaterThan(strategy[2]!);
    });

    it("keeps strategies normalized and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            const s = f.meta["strategy"] as number[] | undefined;
            if (!s) continue;
            expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
            expect(s.every((p) => p >= -1e-9 && p <= 1 + 1e-9)).toBe(true);
        }
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
