/**
 * vizing-edge-coloring.ts - Vizing Fan Algorithm for Edge Coloring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Vizing's theorem says every simple graph with maximum degree Δ admits a
 * proper edge coloring with Δ + 1 colors, so no two edges sharing an endpoint
 * have the same color. This module implements the constructive proof: color
 * edges one at a time, and whenever the greedy choice conflicts, rotate a fan
 * of edges around a vertex and flip a two-color alternating path to free a
 * color.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * n) in the worst case for m edges and n vertices
 *   Space: O(n + m) for the graph, the color map, and the working fan
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Node states stay idle; edge labels show the assigned color number.
 *   - The edge just colored is BLUE (active); finished edges are GREEN.
 *   - The final frame shows every edge colored GREEN with its color label.
 */

import type {
    AlgorithmModule,
    EntityState,
    VisualEdge,
    VisualEntity,
    VisualFrame,
} from "@/types";
import { makeGraphNodes } from "./graph-util";

interface ColoringInput {
    graph?: Record<string, string[]>;
}

/** Undirected edge key, independent of endpoint order. */
function key(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ColoringInput | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "E"],
        C: ["A", "B", "D", "E"],
        D: ["A", "C", "E"],
        E: ["B", "C", "D"],
    };

    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const incident = new Map<string, Set<string>>(labels.map((label) => [label, new Set<string>()]));
    const edgeList: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            if (u === v || !incident.has(u) || !incident.has(v)) {
                continue;
            }
            const k = key(u, v);
            if (!seen.has(k)) {
                seen.add(k);
                incident.get(u)?.add(v);
                incident.get(v)?.add(u);
                edgeList.push([u < v ? u : v, u < v ? v : u]);
            }
        }
    }
    edgeList.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

    let delta = 0;
    for (const label of labels) {
        delta = Math.max(delta, incident.get(label)?.size ?? 0);
    }
    const palette = delta + 1;
    const colors = new Map<string, number>();

    const edgeId = (a: string, b: string): string => `edge-${a < b ? a : b}-${a < b ? b : a}`;
    const colorOf = (u: string, v: string): number => colors.get(key(u, v)) ?? 0;
    const usedAt = (vertex: string): Set<number> => {
        const used = new Set<number>();
        for (const w of incident.get(vertex) ?? []) {
            const c = colorOf(vertex, w);
            if (c > 0) {
                used.add(c);
            }
        }
        return used;
    };
    const missingAt = (vertex: string): number[] => {
        const used = usedAt(vertex);
        const missing: number[] = [];
        for (let c = 1; c <= palette; c += 1) {
            if (!used.has(c)) {
                missing.push(c);
            }
        }
        return missing;
    };

    const makeEntities = (
        activeId: string | null,
        done: boolean,
    ): { nodes: VisualEntity[]; edges: VisualEdge[] } => {
        const nodes: VisualEntity[] =
            labels.length > 0
                ? makeGraphNodes(labels)
                : [
                      {
                          id: "node-empty",
                          type: "node",
                          label: "",
                          value: "",
                          state: "unvisited" as EntityState,
                          x: 0,
                          y: 0,
                          width: 0,
                          height: 0,
                          metadata: { label: "" },
                      },
                  ];
        const edges: VisualEdge[] = edgeList.map(([a, b]) => {
            const id = edgeId(a, b);
            const c = colorOf(a, b);
            return {
                id,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: c === 0 ? "" : String(c),
                state: (done ? "sorted" : id === activeId ? "active" : c === 0 ? "idle" : "visited") as EntityState,
                directed: false,
            };
        });
        return { nodes, edges };
    };

    let step = 0;
    const emit = (activeId: string | null, done: boolean, description: string, line: number): VisualFrame => {
        const { nodes, edges } = makeEntities(activeId, done);
        const colorList = edgeList.map(([a, b]) => colorOf(a, b));
        const distinct = new Set(colorList.filter((c) => c > 0));
        return {
            stepNumber: step++,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                delta,
                palette,
                edges: edgeList.length,
                edgesColored: colorList.filter((c) => c > 0).length,
                colorsUsed: distinct.size,
                edgeColors: colorList,
            },
        };
    };

    yield emit(
        null,
        false,
        `Edge-coloring a ${labels.length}-vertex graph with at most ${palette} colors.`,
        0,
    );

    for (const [u0, v0] of edgeList) {
        if (colorOf(u0, v0) > 0) {
            continue;
        }
        const u = u0;

        // Build a maximal Vizing fan v_0 = v0, v_1, ... around u.
        const fan: string[] = [v0];
        const fanSet = new Set<string>([v0]);
        let terminal = false;
        while (!terminal) {
            const last = fan[fan.length - 1] as string;
            if (missingAt(u).some((c) => missingAt(last).includes(c))) {
                terminal = true;
                break;
            }
            let extension: string | null = null;
            for (const w of incident.get(u) ?? []) {
                if (fanSet.has(w) || colorOf(u, w) === 0) {
                    continue;
                }
                if (missingAt(last).includes(colorOf(u, w))) {
                    extension = w;
                    break;
                }
            }
            if (extension === null) {
                terminal = true;
                break;
            }
            fan.push(extension);
            fanSet.add(extension);
        }

        const k = fan.length - 1;
        const shared = missingAt(u).find((c) => missingAt(fan[k] as string).includes(c));

        if (shared !== undefined) {
            // Case A: rotate the whole fan and place the shared color at the end.
            for (let i = 0; i < k; i += 1) {
                colors.set(key(u, fan[i] as string), colorOf(u, fan[i + 1] as string));
            }
            colors.set(key(u, fan[k] as string), shared);
        } else {
            let j = -1;
            let y = 0;
            for (let idx = 1; idx < k; idx += 1) {
                const c = colorOf(u, fan[idx] as string);
                if (missingAt(fan[k] as string).includes(c)) {
                    j = idx;
                    y = c;
                    break;
                }
            }
            if (j < 0) {
                // Defensive fallback: a free color at u always exists; use it directly.
                const free = missingAt(u)[0] ?? 1;
                colors.set(key(u, fan[0] as string), free);
            } else {
                const x = missingAt(u)[0] ?? 1;
                const predecessor = fan[j - 1] as string;

                // Walk the {x, y}-alternating path from u before changing any color.
                const pathEdges: Array<[string, string]> = [];
                let at = u;
                let want = y;
                const pathVertices = new Set<string>([u]);
                let reached = false;
                while (true) {
                    let next: string | null = null;
                    for (const w of incident.get(at) ?? []) {
                        if (pathVertices.has(w)) {
                            continue;
                        }
                        if (colorOf(at, w) === want) {
                            next = w;
                            break;
                        }
                    }
                    if (next === null) {
                        break;
                    }
                    pathEdges.push([at, next]);
                    if (next === predecessor) {
                        reached = true;
                        break;
                    }
                    pathVertices.add(next);
                    at = next;
                    want = want === x ? y : x;
                }
                for (const [a, b] of pathEdges) {
                    colors.set(key(a, b), colorOf(a, b) === x ? y : x);
                }

                if (!reached) {
                    for (let i = 0; i < j; i += 1) {
                        colors.set(key(u, fan[i] as string), colorOf(u, fan[i + 1] as string));
                    }
                    colors.set(key(u, fan[j] as string), x);
                } else {
                    for (let i = 0; i < k; i += 1) {
                        colors.set(key(u, fan[i] as string), colorOf(u, fan[i + 1] as string));
                    }
                    colors.set(key(u, fan[k] as string), y);
                }
            }
        }

        yield emit(edgeId(u, v0), false, `Colored edge ${u}-${v0}; fan of size ${fan.length + 1} at ${u}.`, 3);
    }

    yield emit(null, true, `Finished a proper edge coloring using at most ${palette} colors.`, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Color the edges so that no two edges meeting at a vertex share a color. Greedy coloring gets stuck when every color at one endpoint is already used at the other. Vizing's trick is to rotate a chain of edges around one endpoint and swap the colors along a two-color alternating path, which frees a color without creating a conflict.",
        invariants: [
            "The coloring is proper at every step: incident edges never share a color.",
            "Only colors from 1 through Δ + 1 are ever assigned.",
            "Each iteration colors exactly one previously uncolored edge, though it may recolor others.",
        ],
        correctness:
            "Each color-extension step either rotates a fan, flips an alternating path, or both. The fan property guarantees that after a rotation the shifted color is missing at the vertex it moves to, and the alternating-path flip preserves proprness because it swaps two colors along a component of the two-color subgraph. Vizing's case analysis shows one of the two cases always applies and results in a proper coloring with one more edge colored, so after all m edges the coloring is proper and uses at most Δ + 1 colors.",
        complexityRationale:
            "Coloring one edge scans a fan and an alternating path, both of length at most O(n) vertices with O(Δ) color checks, so the basic implementation runs in O(m * n) time. The graph, color map, and fan use O(n + m) space.",
        uses: [
            "Scheduling jobs that share a machine into the fewest conflict-free time slots",
            "Assigning radio frequencies so neighboring transmitters do not interfere",
            "Decomposing a graph into matchings for parallel and network scheduling",
        ],
        references: [
            "Vizing, On an Estimate of the Chromatic Class of a Graph, 1964",
            "Wikipedia, 'Vizing's theorem'",
        ],
        workedExample:
            "A triangle has maximum degree two, so three colors suffice. Color A-B with 1 and A-C with 2; B-C cannot use 1 or 2 at its endpoints, so it takes color 3. No two edges at the same vertex share a color, and exactly three colors were used.",
    },
    id: "vizing-edge-coloring",
    name: "Vizing Edge Coloring",
    category: "graph",
    complexity: { time: "O(m * n)", space: "O(n + m)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "E"],
            C: ["A", "B", "D", "E"],
            D: ["A", "C", "E"],
            E: ["B", "C", "D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "let Δ be the largest vertex degree and use colors 1 through Δ + 1",
        "for each uncolored edge (u, v) build a maximal fan at u starting at v",
        "if u and the last fan vertex share a missing color, rotate the fan and use it",
        "otherwise pick a missing color x at u and a fan-edge color y missing at the last vertex",
        "flip the alternating path in colors x and y starting at u",
        "rotate the appropriate part of the fan and color the freed edge",
        "done: report a proper edge coloring with at most Δ + 1 colors",
    ],
};

export default module;
