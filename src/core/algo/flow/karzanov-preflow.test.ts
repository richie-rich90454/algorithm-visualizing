import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./karzanov-preflow";

type Edge = [string, string, number];

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const entity of frame.entities) expect(entity.type).toBe("node");
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Independent Edmonds-Karp reference using a residual capacity matrix. */
function referenceMaxFlow(vertices: string[], edges: Edge[], source: string, sink: string): number {
    const index = new Map(vertices.map((v, i) => [v, i]));
    const n = vertices.length;
    const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const [u, v, c] of edges) {
        const iu = index.get(u) as number;
        const iv = index.get(v) as number;
        (cap[iu] as number[])[iv] = ((cap[iu] as number[])[iv] ?? 0) + c;
    }
    const s = index.get(source) as number;
    const t = index.get(sink) as number;
    let total = 0;
    for (;;) {
        const parent = Array<number>(n).fill(-1);
        parent[s] = s;
        const queue = [s];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            for (let v = 0; v < n; v += 1) {
                if (parent[v] !== -1) continue;
                if (((cap[u] as number[])[v] ?? 0) > 0) {
                    parent[v] = u;
                    queue.push(v);
                }
            }
        }
        if (parent[t] === -1) break;
        let aug = Infinity;
        let cursor = t;
        while (cursor !== s) {
            const p = parent[cursor] as number;
            aug = Math.min(aug, (cap[p] as number[])[cursor] as number);
            cursor = p;
        }
        cursor = t;
        while (cursor !== s) {
            const p = parent[cursor] as number;
            (cap[p] as number[])[cursor] = ((cap[p] as number[])[cursor] as number) - aug;
            (cap[cursor] as number[])[p] = ((cap[cursor] as number[])[p] ?? 0) + aug;
            cursor = p;
        }
        total += aug;
    }
    return total;
}

describe("Karzanov Blocking Flow", () => {
    it("emits well-formed frames and terminates on the default network", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(400);
        const last = frames[frames.length - 1] as VisualFrame;
        const sample = mod.defaultInput as { vertices: string[]; edges: Edge[] };
        expect(last.meta.flow).toBe(referenceMaxFlow(sample.vertices, sample.edges, "S", "T"));
    });

    it("matches an independent maximum-flow reference on random networks", () => {
        let seed = 3141592;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 120; trial += 1) {
            const count = 3 + (next() % 4);
            const vertices = Array.from({ length: count }, (_, i) => `v${i}`);
            const source = vertices[0] as string;
            const sink = vertices[count - 1] as string;
            const edges: Edge[] = [];
            for (let u = 0; u < count; u += 1) {
                for (let v = 0; v < count; v += 1) {
                    if (u === v) continue;
                    if (next() % 3 === 0) edges.push([vertices[u] as string, vertices[v] as string, 1 + (next() % 5)]);
                }
            }
            const input = { vertices, edges, source, sink };
            const frames = collect(input);
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta.flow).toBe(referenceMaxFlow(vertices, edges, source, sink));

            const index = new Map(vertices.map((v, i) => [v, i]));
            const flow: number[][] = Array.from({ length: count }, () => Array<number>(count).fill(0));
            for (const edge of last.edges) {
                const iu = index.get(edge.sourceId.slice(5)) as number;
                const iv = index.get(edge.targetId.slice(5)) as number;
                flow[iu]![iv] = Number(String(edge.label).split("/")[0]);
            }
            for (let v = 0; v < count; v += 1) {
                if (v === 0 || v === count - 1) continue;
                let inflow = 0;
                let outflow = 0;
                for (let u = 0; u < count; u += 1) {
                    inflow += flow[u]![v] ?? 0;
                    outflow += flow[v]![u] ?? 0;
                }
                expect(inflow).toBe(outflow);
            }
        }
    });

    it("returns zero when the sink is unreachable", () => {
        const input = {
            vertices: ["s", "a", "t"],
            edges: [
                ["s", "a", 5] as Edge,
                ["t", "a", 2] as Edge,
            ],
            source: "s",
            sink: "t",
        };
        const frames = collect(input);
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.meta.flow).toBe(0);
    });
});
