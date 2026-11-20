import { describe, expect, it } from "vitest";
import module from "./eigenvector-centrality";

function finalMeta(graph: Record<string, string[]>, iterations = 80) {
    const frames = [...module.run({ graph, iterations })];
    return frames[frames.length - 1]!;
}

const GRAPHS: Record<string, string[]>[] = [
    { A: ["B", "C", "D", "E"], B: ["A", "C"], C: ["A", "B"], D: ["A", "E"], E: ["A", "D"] },
    { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
    { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B"], D: ["A"] },
];

describe("eigenvector-centrality", () => {
    it("converges to a positive eigenvector of the adjacency matrix (property check)", () => {
        for (const graph of GRAPHS) {
            const meta = finalMeta(graph).meta;
            const labels = Object.keys(graph);
            const scores = new Map<string, number>();
            for (const entry of meta.scores as string[]) {
                const [label, value] = entry.split(":");
                scores.set(label as string, Number(value));
            }
            const lambda = meta.lambda as number;
            expect(lambda).toBeGreaterThan(0);
            let norm = 0;
            for (const v of labels) {
                const s = scores.get(v) as number;
                expect(s).toBeGreaterThan(0);
                norm += s * s;
            }
            expect(Math.abs(Math.sqrt(norm) - 1)).toBeLessThan(1e-4);

            // A x should equal lambda * x for each vertex (symmetric graphs).
            for (const v of labels) {
                let inflow = 0;
                for (const u of labels) {
                    if ((graph[u] as string[]).includes(v)) inflow += scores.get(u) as number;
                }
                expect(Math.abs(inflow - lambda * (scores.get(v) as number))).toBeLessThan(1e-3);
            }
        }
    });

    it("ranks the hub highest in a star-with-triangle graph", () => {
        const meta = finalMeta(GRAPHS[2] as Record<string, string[]>).meta;
        expect((meta.ranking as string[])[0]).toBe("A");
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(5);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("graph");
            expect(frame.meta).toHaveProperty("lambda");
            expect(frame.meta).toHaveProperty("scores");
            for (const e of frame.edges) {
                expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
                expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
            }
        });
    });
});
