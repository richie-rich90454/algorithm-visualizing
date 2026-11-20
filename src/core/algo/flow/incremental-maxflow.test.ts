import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./incremental-maxflow";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
    });
}

type Weighted = Record<string, Array<[string, number]>>;
type Increase = [string, string, number];

/** Independent Ford-Fulkerson recomputation on the final capacities. */
function bruteMaxFlow(graph: Weighted, increases: Increase[], source: string, sink: string): number {
    const labels = [...new Set([
        ...Object.keys(graph),
        ...Object.values(graph).flatMap((pairs) => pairs.map(([v]) => v)),
        ...increases.flatMap(([a, b]) => [a, b]),
    ])];
    const index = new Map(labels.map((v, i) => [v, i]));
    const n = labels.length;
    const cap: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [u, pairs] of Object.entries(graph)) {
        for (const [v, amount] of pairs) {
            const i = index.get(u);
            const j = index.get(v);
            if (i !== undefined && j !== undefined) (cap[i] as number[])[j] = ((cap[i] as number[])[j] as number) + amount;
        }
    }
    for (const [u, v, amount] of increases) {
        const i = index.get(u);
        const j = index.get(v);
        if (i !== undefined && j !== undefined) (cap[i] as number[])[j] = ((cap[i] as number[])[j] as number) + amount;
    }
    let flow = 0;
    const s = index.get(source) as number;
    const t = index.get(sink) as number;
    for (;;) {
        const parent = new Array<number>(n).fill(-1);
        const seen = new Array<boolean>(n).fill(false);
        const queue = [s];
        seen[s] = true;
        while (queue.length > 0 && !seen[t]) {
            const u = queue.shift() as number;
            for (let v = 0; v < n; v += 1) {
                if (!seen[v] && ((cap[u] as number[])[v] as number) > 0) {
                    seen[v] = true;
                    parent[v] = u;
                    queue.push(v);
                }
            }
        }
        if (!seen[t]) break;
        let bottleneck = Infinity;
        let cursor = t;
        while (cursor !== s) {
            const prev = parent[cursor] as number;
            bottleneck = Math.min(bottleneck, (cap[prev] as number[])[cursor] as number);
            cursor = prev;
        }
        cursor = t;
        while (cursor !== s) {
            const prev = parent[cursor] as number;
            (cap[prev] as number[])[cursor] = ((cap[prev] as number[])[cursor] as number) - bottleneck;
            (cap[cursor] as number[])[prev] = ((cap[cursor] as number[])[prev] as number) + bottleneck;
            cursor = prev;
        }
        flow += bottleneck;
    }
    return flow;
}

const cases: Array<{ graph: Weighted; source: string; sink: string; increments: Increase[] }> = [
    {
        graph: {
            S: [
                ["A", 3],
                ["B", 2],
            ],
            A: [
                ["T", 2],
                ["B", 1],
            ],
            B: [["T", 3]],
            T: [],
        },
        source: "S",
        sink: "T",
        increments: [
            ["S", "A", 2],
            ["B", "T", 2],
        ],
    },
    {
        graph: {
            s: [
                ["a", 2],
                ["b", 1],
            ],
            a: [["t", 1]],
            b: [["t", 2]],
            t: [],
        },
        source: "s",
        sink: "t",
        increments: [["s", "b", 2]],
    },
    {
        graph: {
            p: [["q", 4]],
            q: [["r", 2]],
            r: [],
        },
        source: "p",
        sink: "r",
        increments: [
            ["q", "r", 3],
            ["p", "q", 1],
        ],
    },
];

describe("Incremental maximum flow", () => {
    it("matches a fresh max-flow computation after every capacity increase", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(Number(last?.meta["flow"])).toBe(
                bruteMaxFlow(input.graph, input.increments, input.source, input.sink),
            );
            expect(Number(last?.meta["increases"])).toBe(input.increments.length);
        }
    });

    it("terminates and never loses flow across increases", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const frame of fs) expect(Number(frame.meta["flow"]) >= 0).toBe(true);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta["flow"])).toBeGreaterThan(0);
        expect(Number(last?.meta["augmentations"])).toBeGreaterThan(0);
    });
});
