import { describe, expect, it } from "vitest";
import mod from "./watts-strogatz-model";
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

describe("Watts-Strogatz Model", () => {
    it("keeps a k-regular simple ring when p is zero", () => {
        const frames = [...mod.run({ n: 10, k: 4, p: 0, seed: 1 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const degree = meta["degree"] as number[];
        expect(degree.length).toBe(10);
        for (const value of degree) expect(value).toBe(4);
        expect(meta["rewired"]).toBe(0);
        const edges = meta["edges"] as string[];
        expect(edges.length).toBe((10 * 4) / 2);
        expect(new Set(edges).size).toBe(edges.length);
        for (const edge of edges) {
            const [a, b] = edge.split("-");
            expect(a).not.toBe(b);
        }
    });

    it("stays simple after rewiring and is deterministic", () => {
        const run = (): Record<string, unknown> => [...mod.run({ n: 12, k: 4, p: 0.6, seed: 9 })].at(-1)!.meta;
        const a = run();
        const b = run();
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        const edges = a["edges"] as string[];
        expect(new Set(edges).size).toBe(edges.length);
        for (const edge of edges) {
            const [u, v] = edge.split("-");
            expect(u).not.toBe(v);
        }
        expect(a["rewired"] as number).toBeGreaterThan(0);
        expect((a["degree"] as number[]).every((d) => d >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
