/**
 * graph-drawing-sugiyama.ts - Sugiyama Layered Graph Drawing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Sugiyama framework draws a directed graph in four stages: break cycles
 * by reversing a few edges, assign every vertex to a layer with longest-path
 * layering, replace long edges by chains of dummy vertices so every edge spans
 * one layer, then sweep barycenter ordering up and down to reduce crossings.
 * The result is a layered layout together with a crossing count.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E + sweeps * E) for layering, dummy insertion, and sweeps
 *   Space: O(V + E) including dummy vertices and their chains
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original vertices are BLUE; dummy vertices are CYAN.
 *   - Reversed edges flash RED; the current sweep flashes YELLOW.
 *   - The final frame reports layer count, dummy count, and crossings.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

interface Arc {
    from: string;
    to: string;
    reversed: boolean;
}

function directedEdges(adjacency: Adj, labels: string[]): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const from of labels) {
        for (const to of adjacency[from] ?? []) {
            if (labels.includes(to) && from !== to) out.push([from, to]);
        }
    }
    return out;
}

function breakCycles(labels: string[], arcs: Array<[string, string]>): Arc[] {
    const color = new Map(labels.map((v) => [v, 0]));
    const result: Arc[] = [];
    const visit = (v: string): void => {
        color.set(v, 1);
        for (const [from, to] of arcs) {
            if (from !== v) continue;
            if (color.get(to) === 1) {
                result.push({ from: to, to: from, reversed: true });
                continue;
            }
            if (color.get(to) === 0) {
                result.push({ from, to, reversed: false });
                visit(to);
            }
        }
        color.set(v, 2);
    };
    for (const v of labels) if (color.get(v) === 0) visit(v);
    for (const [from, to] of arcs) {
        if (!result.some((a) => a.from === to && a.to === from && a.reversed)) {
            if (!result.some((a) => a.from === from && a.to === to && !a.reversed)) {
                result.push({ from, to, reversed: false });
            }
        }
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adj; sweeps?: number } | null) ?? {};
    const adjacency: Adj = task.graph ?? { A: ["D"], B: ["D", "E"], C: ["E"], D: [], E: [] };
    const labels = [
        ...new Set([
            ...Object.keys(adjacency),
            ...Object.values(adjacency).flatMap((ns) => ns.map((n) => String(n))),
        ]),
    ].sort();
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no layered drawing to make.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { layers: 0, dummyCount: 0, crossings: 0 },
        };
        return;
    }
    const sweeps = typeof task.sweeps === "number" ? Math.max(0, Math.min(12, Math.floor(task.sweeps))) : 4;
    const original = directedEdges(adjacency, labels);
    const arcs = breakCycles(labels, original);
    let step = 0;
    const dummyIds = new Set<string>();

    const layerOf = new Map<string, number>(labels.map((v) => [v, 0]));
    // Longest-path layering over the acyclic arc set.
    for (let pass = 0; pass < labels.length; pass += 1) {
        let changed = false;
        for (const arc of arcs) {
            const candidate = (layerOf.get(arc.from) ?? 0) + 1;
            if (candidate > (layerOf.get(arc.to) ?? 0)) {
                layerOf.set(arc.to, candidate);
                changed = true;
            }
        }
        if (!changed) break;
    }
    const maxLayer = Math.max(...layerOf.values());

    // Insert dummy vertices so that every arc spans exactly one layer.
    const chains: Array<string[]> = [];
    for (const arc of arcs) {
        const chain = [arc.from];
        const span = (layerOf.get(arc.to) ?? 0) - (layerOf.get(arc.from) ?? 0);
        for (let l = (layerOf.get(arc.from) ?? 0) + 1; l < (layerOf.get(arc.to) ?? 0); l += 1) {
            const id = `dummy-${arc.from}-${arc.to}-${l}`;
            dummyIds.add(id);
            layerOf.set(id, l);
            chain.push(id);
        }
        chain.push(arc.to);
        chains.push(chain);
    }

    const order = new Map<number, string[]>();
    for (let l = 0; l <= maxLayer; l += 1) {
        order.set(
            l,
            [...labels, ...dummyIds].filter((v) => layerOf.get(v) === l).sort(),
        );
    }

    const crossingCount = (): number => {
        let crossings = 0;
        for (let l = 0; l < maxLayer; l += 1) {
            const upper = order.get(l) ?? [];
            const lower = order.get(l + 1) ?? [];
            const pairs: Array<[number, number]> = [];
            for (const chain of chains) {
                for (let i = 0; i + 1 < chain.length; i += 1) {
                    if (layerOf.get(chain[i] as string) !== l) continue;
                    const u = upper.indexOf(chain[i] as string);
                    const v = lower.indexOf(chain[i + 1] as string);
                    if (u >= 0 && v >= 0) pairs.push([u, v]);
                }
            }
            for (let i = 0; i < pairs.length; i += 1) {
                for (let j = i + 1; j < pairs.length; j += 1) {
                    const a = pairs[i] as [number, number];
                    const b = pairs[j] as [number, number];
                    if (a[0] < b[0] && a[1] > b[1]) crossings += 1;
                    if (b[0] < a[0] && b[1] > a[1]) crossings += 1;
                }
            }
        }
        return crossings;
    };

    const snap = (description: string, line: number, phase: string): VisualFrame => {
        const nodes: VisualEntity[] = [...labels, ...dummyIds].map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: dummyIds.has(id) ? "+" : id,
            value: id,
            state: dummyIds.has(id) ? "path" : "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { layer: layerOf.get(id) ?? 0, dummy: dummyIds.has(id) },
        }));
        const edges: VisualEdge[] = chains.flatMap((chain) =>
            chain.slice(0, -1).map((u, i) => {
                const v = chain[i + 1] as string;
                const key = `${u}|${v}`;
                const reversed = arcs.some((a) => a.reversed && a.to === u && a.from === v);
                const state: EntityState = phase === "reverse" && reversed ? "error" : phase === "sweep" ? "comparing" : "idle";
                return {
                    id: `edge-${key}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: "",
                    state,
                    directed: true,
                };
            }),
        );
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                layers: maxLayer + 1,
                dummyCount: dummyIds.size,
                crossings: crossingCount(),
                arcs: arcs.map((a) => `${a.from}>${a.to}${a.reversed ? "*" : ""}`),
                layersOf: [...labels, ...dummyIds].map((v) => `${v}:${layerOf.get(v) ?? 0}`),
                order: Array.from({ length: maxLayer + 1 }, (_, l) => `${l}:${(order.get(l) ?? []).join(",")}`),
                sweeps,
            },
        };
    };

    yield snap(`Loaded ${labels.length} vertices and ${original.length} arcs for layered drawing.`, 0, "start");
    step += 1;
    const reversed = arcs.filter((a) => a.reversed).length;
    yield snap(`Broke ${reversed} directed cycle(s) by reversing back edges.`, 1, "reverse");
    step += 1;
    yield snap(`Longest-path layering placed vertices across ${maxLayer + 1} layers.`, 2, "layers");
    step += 1;
    yield snap(`Inserted ${dummyIds.size} dummy vertices so every arc spans one layer.`, 3, "dummy");
    step += 1;

    for (let s = 0; s < sweeps; s += 1) {
        const down = s % 2 === 0;
        const indices = down
            ? Array.from({ length: maxLayer + 1 }, (_, i) => i).slice(1)
            : Array.from({ length: maxLayer + 1 }, (_, i) => i).slice(0, -1).reverse();
        for (const l of indices) {
            const positions = new Map<string, number>();
            for (let k = 0; k <= maxLayer; k += 1) {
                (order.get(k) ?? []).forEach((v, idx) => positions.set(v, idx));
            }
            const barycenter = (v: string): number => {
                let sum = 0;
                let count = 0;
                for (const chain of chains) {
                    for (let i = 0; i + 1 < chain.length; i += 1) {
                        const u = chain[i] as string;
                        const w = chain[i + 1] as string;
                        if (down && w === v && positions.has(u)) {
                            sum += positions.get(u) as number;
                            count += 1;
                        }
                        if (!down && u === v && positions.has(w)) {
                            sum += positions.get(w) as number;
                            count += 1;
                        }
                    }
                }
                return count === 0 ? positions.get(v) ?? 0 : sum / count;
            };
            const next = [...(order.get(l) ?? [])].sort((a, b) => {
                const diff = barycenter(a) - barycenter(b);
                return diff !== 0 ? diff : a.localeCompare(b);
            });
            order.set(l, next);
        }
        yield snap(`Barycenter sweep ${s + 1} (${down ? "downward" : "upward"}): ${crossingCount()} crossings.`, 4, "sweep");
        step += 1;
    }

    yield snap(
        `Layered drawing ready: ${maxLayer + 1} layers, ${dummyIds.size} dummy vertices, ${crossingCount()} crossings.`,
        6,
        "done",
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Stack vertices in horizontal layers so every arrow points downward. Long arrows are broken into short pieces with invisible stepping stones. Then repeatedly reorder each layer by the average position of its neighbors above or below, which tends to untangle crossing arrows.",
        invariants: [
            "After dummy insertion every arc connects vertices in adjacent layers.",
            "Reversing a back edge removes the cycle without changing the undirected structure.",
            "Longest-path layering places each head strictly below its tail.",
        ],
        correctness:
            "A directed graph with every back edge reversed is acyclic, so longest-path layering is well defined and gives layer(head) at least layer(tail) plus one for every arc. Splitting an arc at each intermediate layer preserves that relation and leaves only unit-span arcs. Barycenter sweeps only permute vertices within a layer, so all layout invariants survive, and counting inverted endpoint pairs on each adjacent layer pair counts each crossing exactly once.",
        complexityRationale:
            "Cycle breaking and layering each scan arcs a bounded number of times, O(V + E). Dummy insertion adds at most E vertices, and each sweep recomputes barycenters and crossings in O(E + V log V), giving O(sweeps * (E + V log V)) overall with O(V + E) space.",
        uses: [
            "Drawing data-flow and dependency diagrams",
            "Visualizing call graphs and software architecture",
            "Rendering directed acyclic workflows in graph editors",
        ],
        references: [
            "Sugiyama, Tagawa and Odaka, Methods for Visual Understanding of Hierarchical System Structures, 1981",
            "Eades and Wormald, A Heuristic for Reducing Crossings in Bipartite Drawings, 1986",
        ],
        workedExample:
            "With top-layer order A, B, C pointing to D, D, E, E, the bottom order E, D has three crossings. A downward barycenter sweep gives D an average predecessor position of 0.5 and E of 1.5, so the bottom order becomes D, E with zero crossings.",
    },
    id: "graph-drawing-sugiyama",
    name: "Sugiyama Layered Graph Drawing",
    category: "graph",
    complexity: { time: "O(sweeps * (E + V log V))", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["D"], B: ["D", "E"], C: ["E"], D: [], E: [] },
        sweeps: 4,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "reverse depth-first back edges to break all cycles",
        "assign each vertex a layer by longest incoming path",
        "replace long arcs with chains of dummy vertices",
        "initialize the left-to-right order of every layer",
        "alternating downward and upward sweeps",
        "sort each layer by the barycenter of its neighbors",
        "count crossings between each pair of adjacent layers",
        "report the layered drawing and its crossing count",
    ],
};

export default module;
