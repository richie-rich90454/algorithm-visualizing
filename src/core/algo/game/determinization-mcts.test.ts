/** determinization-mcts.test.ts - Aggregation and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./determinization-mcts";

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
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
        expect(f.meta).toBeDefined();
    });
}

describe("Determinization MCTS", () => {
    it("aggregates both worlds to the dominant action", () => {
        const fs = frames({ sims: 300, seed: 777 });
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["best"]).toBe("B");
        const aggregate = last?.["aggregate"] as number[];
        expect(aggregate[1]).toBeGreaterThan(aggregate[0]!);
        expect(aggregate[1]).toBeGreaterThan(aggregate[2]!);
    });

    it("records every simulation exactly once in the world trees", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        const visits = last?.["visits"] as number[][] | undefined;
        expect(visits).toBeDefined();
        const total = visits!.flat().reduce((a, b) => a + b, 0);
        expect(total).toBe(160);
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
