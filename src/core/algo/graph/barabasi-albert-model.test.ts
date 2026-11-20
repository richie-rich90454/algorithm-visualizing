import { describe, expect, it } from "vitest";
import mod from "./barabasi-albert-model";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Barabasi-Albert Model", () => {
    it("adds exactly m edges per new vertex and stays simple", () => {
        const input = { n: 10, m0: 3, m: 2, seed: 1 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const seedEdges = (input.m0 * (input.m0 - 1)) / 2;
        expect((frames[0]!.meta["edges"] as string[]).length).toBe(seedEdges);
        for (let i = 1; i <= input.n - input.m0; i += 1) {
            const previous = (frames[i - 1]!.meta["edges"] as string[]).length;
            const current = (frames[i]!.meta["edges"] as string[]).length;
            expect(current - previous).toBe(input.m);
        }
        const finalMeta = frames[frames.length - 1]!.meta;
        const edges = finalMeta["edges"] as string[];
        expect(edges.length).toBe(seedEdges + (input.n - input.m0) * input.m);
        expect(new Set(edges).size).toBe(edges.length);
        for (const edge of edges) {
            const [a, b] = edge.split("-");
            expect(a).not.toBe(b);
        }
    });

    it("is deterministic and produces a hub with the top degree", () => {
        const run = (): Record<string, unknown> => [...mod.run({ n: 12, m0: 3, m: 2, seed: 5 })].at(-1)!.meta;
        const a = run();
        const b = run();
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        const degree = a["degree"] as number[];
        const hubDegree = a["hubDegree"] as number;
        expect(hubDegree).toBe(Math.max(...degree));
        expect(hubDegree).toBeGreaterThanOrEqual(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
