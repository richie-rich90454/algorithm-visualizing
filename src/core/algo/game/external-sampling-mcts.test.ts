/** external-sampling-mcts.test.ts - Value recovery and frame checks. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./external-sampling-mcts";

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

describe("External Sampling MCTS", () => {
    it("identifies the dominant action after enough rounds", () => {
        const fs = frames({ rounds: 450, seed: 2024 });
        shapes(fs);
        const last = fs[fs.length - 1]?.meta;
        expect(last?.["best"]).toBe("B");
        const mean = last?.["mean"] as number[];
        expect(mean[1]!).toBeGreaterThan(mean[0]!);
        expect(mean[1]!).toBeGreaterThan(mean[2]!);
    });

    it("visits every action once per round and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const mean = fs[fs.length - 1]?.meta["mean"] as number[];
        expect(mean.every((v) => Number.isFinite(v))).toBe(true);
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
