import { describe, expect, it } from "vitest";
import module from "./paton-cycle-basis";

function analyze(graph: Record<string, string[]>) {
    const frames = [...module.run({ graph })];
    const meta = frames[frames.length - 1]!.meta;
    return {
        meta,
        cycles: (meta.cycles as string[]).map((s) => s.split("-")),
    };
}

function undirectedEdges(graph: Record<string, string[]>): Array<[string, string]> {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [u, list] of Object.entries(graph)) {
        for (const v of list) {
            const k = u < v ? `${u}|${v}` : `${v}|${u}`;
            if (u === v || seen.has(k)) continue;
            seen.add(k);
            out.push([u, v]);
        }
    }
    return out;
}

function gf2Rank(vectors: number[][]): number {
    if (vectors.length === 0) return 0;
    const rows = vectors.map((v) => [...v]);
    const width = rows[0]!.length;
    let rank = 0;
    for (let col = 0; col < width && rank < rows.length; col += 1) {
        let pivot = -1;
        for (let r = rank; r < rows.length; r += 1) if (rows[r]![col] === 1) { pivot = r; break; }
        if (pivot < 0) continue;
        [rows[rank], rows[pivot]] = [rows[pivot] as number[], rows[rank] as number[]];
        for (let r = 0; r < rows.length; r += 1) {
            if (r !== rank && rows[r]![col] === 1) {
                for (let c = 0; c < width; c += 1) rows[r]![c] = (rows[r]![c]! + rows[rank]![c]!) % 2;
            }
        }
        rank += 1;
    }
    return rank;
}

describe("paton-cycle-basis", () => {
    it("produces valid, independent cycles with the right dimension (brute force)", () => {
        let seed = 31415926;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const n = 2 + (rand() % 6);
            const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Record<string, string[]> = Object.fromEntries(labels.map((v) => [v, [] as string[]]));
            const p = 0.3 + (rand() % 50) / 100;
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rand() / 0x7fffffff < p) {
                        graph[labels[i] as string]!.push(labels[j] as string);
                        graph[labels[j] as string]!.push(labels[i] as string);
                    }
                }
            }
            const { meta, cycles } = analyze(graph);
            const edges = undirectedEdges(graph);
            const edgeIndex = new Map(edges.map(([a, b], i) => [(a < b ? `${a}|${b}` : `${b}|${a}`), i]));

            expect(cycles.length).toBe(meta.expected);
            const vectors: number[][] = [];
            for (const cycle of cycles) {
                expect(cycle[0]).toBe(cycle[cycle.length - 1]);
                for (let i = 0; i < cycle.length - 1; i += 1) {
                    const a = cycle[i] as string;
                    const b = cycle[i + 1] as string;
                    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
                    expect(edgeIndex.has(k)).toBe(true);
                }
                const vec = new Array(edges.length).fill(0);
                for (let i = 0; i < cycle.length - 1; i += 1) {
                    const a = cycle[i] as string;
                    const b = cycle[i + 1] as string;
                    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
                    vec[edgeIndex.get(k) as number] = ((vec[edgeIndex.get(k) as number] as number) + 1) % 2;
                }
                vectors.push(vec);
            }
            expect(gf2Rank(vectors)).toBe(cycles.length);
        }
    });

    it("the default square-with-diagonal has a two-cycle basis", () => {
        const { meta, cycles } = analyze((module.defaultInput as { graph: Record<string, string[]> }).graph);
        expect(cycles.length).toBe(2);
        expect(meta.expected).toBe(2);
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("graph");
            expect(frame.meta).toHaveProperty("cycleCount");
            for (const e of frame.edges) {
                expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
                expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
            }
        });
    });
});
