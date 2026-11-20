/**
 * smallest-last-coloring.ts - Smallest-Last Ordering Coloring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Repeatedly remove a vertex of minimum degree from the remaining graph. The
 * reverse of that removal sequence is the smallest-last order. Coloring the
 * vertices greedily in this order gives the smallest color absent from the
 * already-colored neighbors. The ordering keeps hard, dense vertices late so
 * they see fewer colored neighbors and often reuse low colors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2) for the peeling plus O(V + E) for the coloring
 *   Space: O(V + E) for the adjacency sets and colors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being removed or colored is YELLOW (comparing).
 *   - Finished vertices are GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adjacency = Record<string, string[]>;

interface Undirected {
    labels: string[];
    neighbors: Map<string, string[]>;
    pairs: Array<[string, string]>;
}

/** Symmetrize the input into a simple undirected graph. */
function symmetrize(input: Adjacency): Undirected {
    const labels = [...new Set([...Object.keys(input), ...Object.values(input).flat()])].sort();
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [from, targets] of Object.entries(input)) {
        for (const to of targets) {
            if (from === to || !sets.has(from) || !sets.has(to)) continue;
            sets.get(from)?.add(to);
            sets.get(to)?.add(from);
        }
    }
    const neighbors = new Map(labels.map((v) => [v, [...(sets.get(v) ?? [])].sort()]));
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const a = labels[i] as string;
            const b = labels[j] as string;
            if (neighbors.get(a)?.includes(b)) pairs.push([a, b]);
        }
    }
    return { labels, neighbors, pairs };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adjacency } | null) ?? {};
    const graph: Adjacency = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "E"],
        C: ["A", "B", "E"],
        D: ["A"],
        E: ["B", "C"],
    };
    const { labels, neighbors, pairs } = symmetrize(graph);
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is nothing to color.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { colors: 0, vertices: 0 },
        };
        return;
    }

    const nodes = makeGraphNodes(labels);
    const edges: VisualEdge[] = pairs.map(([a, b]) => ({
        id: `edge-${a}-${b}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const reset = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    // Peel off minimum-degree vertices.
    const remaining = new Set(labels);
    const peeling: string[] = [];
    yield snap(`Start with ${labels.length} vertices and ${pairs.length} edges.`, 0, {
        vertices: labels.length,
        edges: pairs.length,
    });
    step += 1;
    while (remaining.size > 0) {
        let pick: string | null = null;
        let best = Infinity;
        for (const v of [...remaining].sort()) {
            let degree = 0;
            for (const nb of neighbors.get(v) ?? []) if (remaining.has(nb)) degree += 1;
            if (degree < best) {
                best = degree;
                pick = v;
            }
        }
        if (pick === null) break;
        reset();
        const current = byId.get(`node-${pick}`);
        if (current) current.state = "comparing";
        remaining.delete(pick);
        peeling.push(pick);
        yield snap(
            `Remove ${pick}, whose current degree is ${best}; ${remaining.size} vertices remain.`,
            2,
            { removed: peeling.length, degree: best, remaining: remaining.size },
        );
        step += 1;
    }

    const coloringOrder = [...peeling].reverse();
    const colors = new Map<string, number>();
    for (const v of coloringOrder) {
        reset();
        const node = byId.get(`node-${v}`);
        if (node) node.state = "comparing";
        const used = new Set<number>();
        for (const nb of neighbors.get(v) ?? []) {
            const c = colors.get(nb);
            if (c !== undefined) {
                used.add(c);
                const e = edges.find((x) =>
                    (x.sourceId === `node-${v}` && x.targetId === `node-${nb}`) ||
                    (x.sourceId === `node-${nb}` && x.targetId === `node-${v}`),
                );
                if (e) e.state = "swapped";
            }
        }
        let color = 0;
        while (used.has(color)) color += 1;
        colors.set(v, color);
        if (node) node.state = "sorted";
        yield snap(
            `Coloring order gives ${v} the smallest free color ${color} (neighbors used {${[...used].sort((a, b) => a - b).join(",")}}).`,
            4,
            { colored: colors.size, color, order: coloringOrder.indexOf(v) + 1 },
        );
        step += 1;
    }

    const palette: EntityState[] = ["sorted", "visited", "highlight", "comparing", "active"];
    reset();
    for (const [v, c] of colors) {
        const node = byId.get(`node-${v}`);
        if (node) node.state = palette[c % palette.length] as EntityState;
    }
    const usedColors = Math.max(...colors.values()) + 1;
    yield snap(
        `Smallest-last order ${coloringOrder.join(", ")} yields a proper coloring with ${usedColors} color(s).`,
        6,
        {
            colors: usedColors,
            order: coloringOrder.join(","),
            coloring: Object.fromEntries(colors),
            vertices: labels.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Peel the graph by repeatedly taking a vertex of minimum degree, then color in the reverse of that peeling sequence. The vertices removed last are the most constrained ones, so handling them first in the greedy pass lets them claim low colors before their neighbors do.",
        invariants: [
            "Each peeling step removes a vertex of minimum degree in the remaining graph.",
            "The coloring order is the exact reverse of the peeling order.",
            "A vertex always takes the smallest nonnegative color absent from its already-colored neighbors.",
        ],
        correctness:
            "Greedy coloring in any order produces a proper coloring, because a vertex only avoids colors used by colored neighbors. The reverse peeling order is the smallest-last order of Matula and Beck, whose property is that every vertex sees at most its original degree in already-colored neighbors when it is colored; hence the number of colors is at most the maximum degree plus one.",
        complexityRationale:
            "Finding a minimum-degree vertex at each of V removal steps scans all adjacency lists, giving O(V^2). The coloring pass scans each edge once, so the total time is O(V^2) and the adjacency sets and color map use O(V + E) space.",
        uses: [
            "Register allocation heuristics in compilers",
            " exam and job scheduling with conflict graphs",
            " a deterministic baseline for graph coloring heuristics",
        ],
        references: [
            "Matula and Beck, Smallest-Last Ordering and Clustering and Graph Coloring Algorithms (1983)",
            "Jensen and Toft, Graph Coloring Problems",
        ],
        workedExample:
            "For the graph A-B, A-C, A-D, B-C, B-E, C-E, peeling removes D (degree 1), then A (degree 2 among the rest), then B and C, then E. Reversing gives E, C, B, A, D: E takes color 0, C color 1, B color 2, A color 0, and D color 1, a proper coloring with three colors.",
    },
    id: "smallest-last-coloring",
    name: "Smallest-Last Ordering Coloring",
    category: "graph",
    complexity: { time: "O(V^2)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "E"],
            C: ["A", "B", "E"],
            D: ["A"],
            E: ["B", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the input into a simple undirected graph",
        "put every vertex in the remaining set",
        "while vertices remain, remove one of minimum current degree",
        "reverse the removal sequence to get the coloring order",
        "for each vertex in that order collect colored neighbor colors",
        "assign the smallest unused color to the vertex",
        "done: a proper coloring with at most maximum degree plus one colors",
    ],
};

export default module;
