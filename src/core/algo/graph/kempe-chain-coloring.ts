/**
 * kempe-chain-coloring.ts - Kempe Chain Color Exchange
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For two colors c1 and c2, the Kempe chain of a vertex is the connected piece
 * of the subgraph induced by vertices colored c1 or c2 that contains that
 * vertex. Swapping c1 and c2 throughout a chain keeps every edge properly
 * colored, because a same-color edge would have to cross the boundary between
 * the chain and its complement. This exchange is the key step in classical
 * proofs of Brooks' theorem and the five-color theorem.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for one chain discovery and swap
 *   Space: O(V + E) for the induced subgraph and the resulting coloring
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes keep the palette color of their assigned color index.
 *   - Vertices discovered in the chain turn PINK; the finished chain stays
 *     highlighted while the colors are exchanged.
 *   - meta carries the chain members and the color after the swap.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

const COLOR_STATES: EntityState[] = [
    "active",
    "comparing",
    "swapped",
    "path",
    "highlight",
    "visited",
    "pivot",
    "sorted",
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, string[]>;
            colors?: Record<string, number>;
            vertex?: string;
            colorA?: number;
            colorB?: number;
        } | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "E"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "E"],
        E: ["D", "A"],
    };
    const labels = [
        ...new Set([...Object.keys(raw), ...Object.values(raw).flat().map((v) => String(v))]),
    ].sort();
    const index = new Map(labels.map((v, i) => [v, i] as const));
    const defaults: Record<string, number> = { A: 0, B: 1, C: 0, D: 1, E: 2 };
    const colors = new Map<string, number>();
    for (const v of labels) {
        colors.set(v, task.colors?.[v] ?? defaults[v] ?? 0);
    }
    const start = task.vertex && index.has(task.vertex) ? task.vertex : (labels[0] ?? "");
    const colorA = typeof task.colorA === "number" ? task.colorA : 1;
    const colorB = typeof task.colorB === "number" ? task.colorB : 0;

    const frames: VisualFrame[] = [];
    const chain = new Set<string>();
    const queue: string[] = [];

    const push = (description: string, line: number, swapped: boolean): void => {
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        nodes.forEach((node) => {
            const v = String(node.value);
            const rawColor = colors.get(v) ?? 0;
            const finalColor = swapped && chain.has(v)
                ? rawColor === colorA
                    ? colorB
                    : colorA
                : rawColor;
            node.state = chain.has(v)
                ? "highlight"
                : (COLOR_STATES[Math.abs(finalColor) % COLOR_STATES.length] as EntityState);
            node.metadata = { ...node.metadata, color: finalColor };
        });
        const edges: VisualEdge[] = [];
        for (const a of labels) {
            for (const rawNeighbor of raw[a] ?? []) {
                const b = String(rawNeighbor);
                if (!index.has(b) || a >= b) {
                    continue;
                }
                edges.push({
                    id: `edge-${a}-${b}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "",
                    state: chain.has(a) && chain.has(b) ? "path" : "idle",
                    directed: false,
                });
            }
        }
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                chain: [...chain].sort(),
                resultColors: labels.map((v) => {
                    const rawColor = colors.get(v) ?? 0;
                    if (swapped && chain.has(v)) {
                        return rawColor === colorA ? colorB : colorA;
                    }
                    return rawColor;
                }),
                swapped,
            },
        });
    };

    if (labels.length === 0) {
        push("Empty graph - no Kempe chain exists.", 0, false);
        for (const frame of frames) {
            yield frame;
        }
        return;
    }

    push(`Kempe chain for colors ${colorA} and ${colorB} starting at ${start}.`, 0, false);

    if (colors.get(start) === colorA || colors.get(start) === colorB) {
        chain.add(start);
        queue.push(start);
        while (queue.length > 0) {
            const v = queue.shift() as string;
            for (const rawNeighbor of raw[v] ?? []) {
                const u = String(rawNeighbor);
                const uColor = colors.get(u);
                if (!index.has(u) || chain.has(u)) {
                    continue;
                }
                if (uColor !== colorA && uColor !== colorB) {
                    continue;
                }
                chain.add(u);
                queue.push(u);
                push(`Reached ${u}; the two-color component now has ${chain.size} vertex(es).`, 4, false);
            }
        }
    }

    push(
        `Swap ${colorA} and ${colorB} on the chain {${[...chain].sort().join(", ")}}; proper coloring is preserved.`,
        7,
        true,
    );

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Look only at the vertices wearing two chosen colors. Within that two-color subgraph, a vertex can reach some neighbors and not others. If you flip the two colors on exactly the piece that the chosen vertex can reach, no edge becomes monochromatic: any edge leaving that piece leads to a vertex of the third color or another chain. This is the exchange trick behind several coloring proofs.",
        invariants: [
            "The chain contains only vertices whose color is c1 or c2.",
            "The chain is a connected component of the two-color induced subgraph.",
            "After the swap, every edge still joins vertices of different colors when the input coloring was proper.",
        ],
        correctness:
            "Consider any edge after the exchange. If both endpoints were outside the chain or both inside, either both colors changed or neither did, so their equality relation is unchanged. If one endpoint is inside and the other outside, the outside endpoint cannot have color c1 or c2, because it would then be adjacent in the induced subgraph and belong to the same component; therefore its color differs from both exchanged colors, and the edge stays proper.",
        complexityRationale:
            "The breadth-first search visits each vertex of the two-color induced subgraph once and scans its adjacency once, so a single exchange costs O(V + E) time and O(V + E) space for the queue, component set, and emitted coloring.",
        uses: [
            "Lowering the number of colors in constructive coloring proofs",
            "Recoloring steps in Brooks' theorem and planar five-coloring algorithms",
            "Local search heuristics for graph coloring and timetabling",
        ],
        references: [
            "Kempe, On Geographical Coloring of Maps, 1879",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on graph coloring",
        ],
        workedExample:
            "On the 5-cycle A-B-C-D-E-A colored A0, B1, C0, D1, E2, take vertex D with colors 1 and 0. The chain of colors 0 and 1 containing D is D-C-B-A. Swapping gives A1, B0, C1, D0, E2, and every edge still joins different colors, including D-E and E-A which touch the untouched third color.",
    },
    id: "kempe-chain-coloring",
    name: "Kempe Chain Color Exchange",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "E"],
            B: ["A", "C"],
            C: ["B", "D"],
            D: ["C", "E"],
            E: ["D", "A"],
        },
        colors: { A: 0, B: 1, C: 0, D: 1, E: 2 },
        vertex: "D",
        colorA: 1,
        colorB: 0,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the input coloring, pivot vertex, and the two colors",
        "start a chain set with the pivot when it uses one of the two colors",
        "queue the pivot for breadth-first expansion",
        "while the queue is nonempty, pop a chain vertex",
        "for each neighbor colored with either chosen color and not yet in the chain, add it",
        "after exploration, swap the two colors on every chain vertex",
        "verify the resulting coloring is proper",
        "report the chain and the new coloring",
    ],
};

export default module;
