/**
 * clique-cover.ts - Minimum Clique Cover via Complement Coloring
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A clique cover partitions the vertices of a graph into the fewest cliques.
 * Coloring the complement graph assigns the same color only to non-adjacent
 * complement vertices, which are exactly mutually adjacent original vertices.
 * A branch-and-bound search over color assignments therefore returns a minimum
 * clique cover.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^V) worst case for V vertices and k colors; pruned in practice
 *   Space: O(V + E) for the complement graph, colors, and the best cover
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original graph edges are faint; nodes in the same clique share a color.
 *   - A vertex receiving a color is highlighted during the search.
 *   - meta carries the best cover found so far as joined vertex groups.
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
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D", "E"],
        D: ["A", "B", "C", "E"],
        E: ["C", "D"],
    };

    const labels = [
        ...new Set([...Object.keys(raw), ...Object.values(raw).flat().map((v) => String(v))]),
    ].sort();
    const n = labels.length;
    const original = new Set<string>();
    const key = (a: string, b: string): string => [a, b].sort().join("|");
    for (const a of labels) {
        for (const rawNeighbor of raw[a] ?? []) {
            const b = String(rawNeighbor);
            if (a !== b && labels.includes(b)) {
                original.add(key(a, b));
            }
        }
    }
    const complement: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (!original.has(key(labels[i] as string, labels[j] as string))) {
                complement[i]?.add(j);
                complement[j]?.add(i);
            }
        }
    }

    const frames: VisualFrame[] = [];
    const colors = Array<number>(n).fill(-1);
    const searchOrder = labels
        .map((_v, i) => i)
        .sort((a, b) => (complement[b]?.size ?? 0) - (complement[a]?.size ?? 0) || a - b);
    let bestCount = n + 1;
    let bestColors = [...colors];

    const groupsOf = (assignment: number[]): string[][] => {
        const groups = new Map<number, string[]>();
        assignment.forEach((c, i) => {
            if (c < 0) {
                return;
            }
            const group = groups.get(c) ?? [];
            group.push(labels[i] as string);
            groups.set(c, group);
        });
        return [...groups.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    };

    const push = (description: string, line: number, assignment: number[], count: number): void => {
        if (frames.length >= 500) {
            return;
        }
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        nodes.forEach((node, i) => {
            const c = assignment[i] ?? -1;
            node.state = c < 0 ? "unvisited" : (COLOR_STATES[c % COLOR_STATES.length] as EntityState);
            node.metadata = { ...node.metadata, color: c };
        });
        const edges: VisualEdge[] = [...original].sort().map((k, i) => {
            const [a, b] = k.split("|") as [string, string];
            return {
                id: `edge-${i}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: "",
                state: "idle",
                directed: false,
            };
        });
        const groups = groupsOf(assignment);
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                cliques: groups.map((g) => g.join("+")),
                cliqueCount: count,
                assigned: assignment.filter((c) => c >= 0).length,
            },
        });
    };

    push("Minimum clique cover: color the complement graph by branch and bound.", 0, colors, 0);

    const dfs = (pos: number, used: number): void => {
        if (used >= bestCount) {
            return;
        }
        if (pos === n) {
            bestCount = used;
            bestColors = [...colors];
            return;
        }
        const v = searchOrder[pos] as number;
        const forbidden = new Set<number>();
        for (let p = 0; p < pos; p += 1) {
            const u = searchOrder[p] as number;
            if (complement[u]?.has(v)) {
                forbidden.add(colors[u] as number);
            }
        }
        for (let c = 0; c <= used; c += 1) {
            if (forbidden.has(c)) {
                continue;
            }
            if (c === used && used + 1 >= bestCount) {
                continue;
            }
            colors[v] = c;
            push(
                `Assign ${labels[v]} complement color ${c}; tentative cover has ${Math.max(used, c + 1)} clique(s).`,
                4,
                colors,
                Math.max(used, c + 1),
            );
            dfs(pos + 1, Math.max(used, c + 1));
            colors[v] = -1;
        }
    };
    dfs(0, 0);

    if (bestCount > n) {
        bestCount = 0;
        bestColors = Array<number>(n).fill(-1);
    }
    const finalGroups = groupsOf(bestColors);
    push(
        `Minimum clique cover uses ${bestCount} clique(s): ${finalGroups.map((g) => `{${g.join(", ")}}`).join(" ")}.`,
        7,
        bestColors,
        bestCount,
    );

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two vertices can share a clique exactly when they are adjacent, so a set of cliques covering every vertex is the same thing as a proper coloring of the complement graph. Coloring the complement greedily is easy but not always optimal, so the search tries color assignments and prunes branches that already use at least as many colors as the best cover found.",
        invariants: [
            "Vertices sharing a color in the complement are non-adjacent there, hence adjacent in the original graph.",
            "The branch-and-bound search never assigns a color already used by a complement neighbor.",
            "bestCount is the smallest number of colors seen in any complete assignment so far.",
        ],
        correctness:
            "Every complete assignment produced by the search is a proper coloring of the complement, so each color class is a clique of the original graph and the classes partition the vertex set. Conversely any clique cover induces such a coloring. Because new colors are introduced in increasing order, every partition is considered up to renaming, and pruning only discards branches that cannot beat the incumbent; therefore the smallest count found is the minimum clique cover.",
        complexityRationale:
            "There are up to k^V color assignments before pruning, so the worst case is exponential; complement degrees and the incumbent bound cut most branches on sparse complements. Storing the complement, the current coloring, and the incumbent uses O(V + E) space.",
        uses: [
            "Covering a compatibility graph with the fewest test groups",
            "Assigning shared resources to mutually compatible tasks",
            "Reducing graph coloring questions to complement structure",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on graph coloring",
            "Garey and Johnson, Computers and Intractability, chapter on NP-complete graph problems",
        ],
        workedExample:
            "A path A-B-C has complement edges A-C only. Assigning color 0 to A and C (they are non-adjacent in the complement) and color 1 to B gives cliques {A, C} and {B}, so the minimum clique cover has size two. A triangle has an edgeless complement and needs three cliques of one vertex each.",
    },
    id: "clique-cover",
    name: "Minimum Clique Cover",
    category: "graph",
    complexity: { time: "O(k^V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D", "E"],
            D: ["A", "B", "C", "E"],
            E: ["C", "D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the complement graph from the input adjacency",
        "order vertices by decreasing complement degree",
        "start with no colors and a trivial all-singletons cover",
        "for the next vertex in the order, collect colors barred by complement neighbors",
        "try each existing allowed color and then one fresh color",
        "prune a branch once it reaches the current best cover size",
        "on a complete assignment, record it if it uses fewer cliques",
        "report the minimum clique cover",
    ],
};

export default module;
