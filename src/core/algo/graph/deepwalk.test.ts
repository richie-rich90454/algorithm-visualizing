import { describe, expect, it } from "vitest";
import mod from "./deepwalk";

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

describe("DeepWalk", () => {
    const lines = mod.pseudocode?.length ?? 1;
    const input = mod.defaultInput as { graph: Record<string, string[]>; seed: number };

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run(mod.defaultInput)].map((f) => f.meta);
        const b = [...mod.run(mod.defaultInput)].map((f) => f.meta);
        expect(a).toEqual(b);
    });

    it("walks follow real edges and co-occurrence counts match the walks", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const paths = frames.filter((f) => Array.isArray(f.meta["path"])).map((f) => f.meta["path"] as string[]);
        expect(paths.length).toBeGreaterThan(0);
        const adj = input.graph;
        for (const path of paths) {
            for (let i = 0; i + 1 < path.length; i += 1) {
                const u = path[i] as string;
                const v = path[i + 1] as string;
                expect(adj[u] ?? []).toContain(v);
            }
        }
        const window = input.graph ? 2 : 2;
        const counts = new Map<string, number>();
        const labels = Object.keys(adj).sort();
        const rank = new Map(labels.map((v, i) => [v, i]));
        for (const path of paths) {
            for (let i = 0; i < path.length; i += 1) {
                for (let j = i + 1; j < Math.min(path.length, i + 1 + window); j += 1) {
                    const a = path[i] as string;
                    const b = path[j] as string;
                    if (a === b) continue;
                    const key = (rank.get(a) as number) < (rank.get(b) as number) ? `${a},${b}` : `${b},${a}`;
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                }
            }
        }
        const coocFrame = frames.find((f) => Array.isArray(f.meta["cooc"]));
        const reported = new Map<string, number>();
        for (const entry of coocFrame?.meta["cooc"] as string[] ?? []) {
            const [a, b, c] = entry.split(",");
            reported.set(`${a},${b}`, Number(c));
        }
        expect([...reported.entries()].sort()).toEqual([...counts.entries()].sort());
    });

    it("produces a finite embedding for every vertex", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        const embedding = last?.meta["embedding"] as string[];
        expect(embedding.length).toBe(Object.keys(input.graph).length);
        for (const row of embedding) {
            const parts = row.split(",");
            expect(Number.isFinite(Number(parts[1]))).toBe(true);
            expect(Number.isFinite(Number(parts[2]))).toBe(true);
        }
    });
});
