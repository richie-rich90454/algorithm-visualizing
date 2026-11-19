import { describe, expect, it } from "vitest";
import mod, { independentCascadeRounds } from "./independent-cascade-model";

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("graph");
    expect(frame.meta).toBeTypeOf("object");
}

describe("Independent Cascade Model", () => {
    const lines = mod.pseudocode?.length ?? 1;
    const input = mod.defaultInput as { graph: Record<string, Array<[string, number]>>; seeds: string[]; seed: number };

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("matches reachability when every transmission is probability 0 or 1", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        const reached = new Set(input.seeds);
        const queue = [...input.seeds];
        for (let head = 0; head < queue.length; head += 1) {
            const u = queue[head] as string;
            for (const [v, p] of input.graph[u] ?? []) {
                if (p > 0 && !reached.has(v)) {
                    reached.add(v);
                    queue.push(v);
                }
            }
        }
        expect([...(last?.meta["activeList"] as string[] ?? [])].sort()).toEqual([...reached].sort());
    });

    it("grows the active set monotonically and is deterministic", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const sizes = frames.map((f) => (f.meta["activeList"] as string[]).length);
        for (let i = 1; i < sizes.length; i += 1) expect(sizes[i] as number).toBeGreaterThanOrEqual(sizes[i - 1] as number);
        const again = [...mod.run(mod.defaultInput)].map((f) => f.meta);
        expect(frames.map((f) => f.meta)).toEqual(again);
        const rounds = independentCascadeRounds(input.graph, input.seeds, input.seed);
        expect(rounds[rounds.length - 1]).toEqual(frames[frames.length - 1]?.meta["activeList"]);
    });
});
