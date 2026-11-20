/** information-set-mcts.test.ts - Strategy and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./information-set-mcts";

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
        expect(f.entities.length).toBe(9);
        expect(f.entities.every((e) => Number.isFinite(e.x))).toBe(true);
        expect(f.meta).toBeDefined();
    });
}

describe("Information Set MCTS", () => {
    it("finds the best action inside each information set", () => {
        const fs = frames({ sims: 300, seed: 31337 });
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["best"]).toEqual(["B", "A"]);
        expect(last?.["winner"]).toBe("B");
    });

    it("assigns one action per set and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const strategy = last?.meta["best"] as string[];
        expect(strategy).toHaveLength(2);
        expect(strategy.every((s) => ["A", "B", "C"].includes(s))).toBe(true);
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
