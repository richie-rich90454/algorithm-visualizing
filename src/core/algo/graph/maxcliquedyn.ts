/**
 * maxcliquedyn.ts - MaxCliqueDyn Maximum Clique Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MaxCliqueDyn is a branch-and-bound maximum clique algorithm. It colors the
 * current candidate set greedily; the largest color used is an upper bound on
 * any clique inside that set. Candidates are tried in color order, and the
 * coloring is recomputed dynamically for each recursive neighborhood so the
 * bound tightens as the search descends. The "dyn" refers to these adaptive
 * bounds, not to updates of the input graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^(V/2)) typical for the coloring bound; O(2^V) worst case
 *   Space: O(V^2) for adjacency, candidate sets, and recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The growing clique Q is GREEN (sorted).
 *   - The active candidate set R is YELLOW (comparing).
 *   - Bound-based pruning flashes RED (error); the best clique is PINK.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface CliqueInput {
    graph?: Record<string, string[]>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CliqueInput | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "E"],
        C: ["A", "B", "D", "E"],
        D: ["A", "C"],
        E: ["B", "C"],
        F: ["G"],
        G: ["F"],
    };
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat()])].sort((a, b) => {
        const degree = (v: string): number => (raw[v] ?? []).length;
        return degree(b) - degree(a) || a.localeCompare(b);
    });
    const adjacency = new Map<string, Set<string>>(labels.map((v) => [v, new Set<string>()]));
    for (const [u, neighbors] of Object.entries(raw)) {
        for (const v of neighbors) {
            adjacency.get(u)?.add(v);
            adjacency.get(v)?.add(u);
        }
    }

    const nodes = makeGraphNodes(labels);
    const edges: VisualEdge[] = [];
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            const a = labels[i] as string;
            const b = labels[j] as string;
            if (adjacency.get(a)?.has(b)) {
                edges.push({
                    id: `edge-${a}-${b}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    const colorSort = (vertices: string[]): Map<string, number> => {
        const colors = new Map<string, number>();
        const ordered: string[] = [];
        for (const v of vertices) {
            const used = new Set<number>();
            for (const u of ordered) {
                if (adjacency.get(v)?.has(u)) {
                    used.add(colors.get(u) as number);
                }
            }
            let color = 1;
            while (used.has(color)) {
                color += 1;
            }
            colors.set(v, color);
            ordered.push(v);
        }
        return colors;
    };

    let step = 0;
    let branches = 0;
    let prunes = 0;
    let best: string[] = [];

    const frame = (
        description: string,
        codeLineNumber: number,
        clique: string[],
        candidates: string[],
        pruned: boolean,
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => {
        const cliqueSet = new Set(clique);
        const candidateSet = new Set(candidates);
        return {
            stepNumber: step,
            entities: nodes.map((node) => {
                const label = node.label;
                let state: EntityState = cliqueSet.has(label)
                    ? "sorted"
                    : candidateSet.has(label)
                      ? "comparing"
                      : "unvisited";
                if (pruned && candidateSet.has(label)) {
                    state = "error";
                }
                if (best.includes(label) && !cliqueSet.has(label)) {
                    state = "highlight";
                }
                return { ...node, state };
            }),
            edges: edges.map((edge) => {
                const source = edge.sourceId.replace("node-", "");
                const target = edge.targetId.replace("node-", "");
                return {
                    ...edge,
                    state: cliqueSet.has(source) && cliqueSet.has(target) ? "path" : "idle",
                };
            }),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { bestSize: best.length, bestClique: best.join(","), branches, prunes, ...extra },
        };
    };

    const initialColors = colorSort(labels);
    yield frame(
        `MaxCliqueDyn: ${labels.length} vertex(es) sorted by degree, initial colors range up to ${Math.max(0, ...initialColors.values())}.`,
        0,
        [],
        labels,
        false,
    );
    step += 1;

    function* expand(R: string[], colors: Map<string, number>, Q: string[]): Generator<VisualFrame, void, unknown> {
        const sorted = [...R].sort(
            (a, b) => (colors.get(a) as number) - (colors.get(b) as number) || a.localeCompare(b),
        );
        while (sorted.length > 0) {
            const bound = Math.max(...sorted.map((v) => colors.get(v) as number));
            if (Q.length + bound <= best.length) {
                prunes += 1;
                const pruneFrame = frame(
                    `Prune: clique size ${Q.length} plus color bound ${bound} cannot beat ${best.length}.`,
                    2,
                    [],
                    sorted,
                    true,
                );
                pruneFrame.stepNumber = step;
                yield pruneFrame;
                step += 1;
                return;
            }
            const p = sorted.pop() as string;
            const color = colors.get(p) as number;
            if (Q.length + color <= best.length) {
                prunes += 1;
                continue;
            }
            branches += 1;
            Q.push(p);
            const next = sorted.filter((v) => adjacency.get(p)?.has(v));
            const branchFrame = frame(
                `Branch on ${p} (color ${color}): candidate neighborhood has ${next.length} vertex(es).`,
                3,
                Q,
                next,
                false,
                { color },
            );
            branchFrame.stepNumber = step;
            yield branchFrame;
            step += 1;
            if (next.length === 0) {
                if (Q.length > best.length) {
                    best = [...Q];
                    const improved = frame(
                        `New maximum clique of size ${best.length}: {${best.join(", ")}}.`,
                        4,
                        Q,
                        [],
                        false,
                    );
                    improved.stepNumber = step;
                    yield improved;
                    step += 1;
                }
            } else {
                yield* expand(next, colorSort(next), Q);
            }
            Q.pop();
        }
    }

    yield* expand(labels, initialColors, []);

    const result = best.slice().sort();
    const final = frame(
        `Maximum clique has ${result.length} vertex(es): {${result.join(", ")}} after ${branches} branch(es) and ${prunes} prune(s).`,
        6,
        result,
        [],
        false,
    );
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A proper coloring of the candidate set gives a free upper bound: if the candidates use c colors, no clique inside them can have more than c vertices. Try candidates in color order, recolor the neighborhood after each choice, and cut off any branch whose bound cannot beat the best clique found so far. Updating the bound at every level is what makes this version dynamic.",
        invariants: [
            "The coloring of a candidate set is proper, so its largest color bounds the clique size inside it.",
            "Q is always a clique in the original graph.",
            "best is the largest clique found so far and never decreases.",
        ],
        correctness:
            "Vertices of a clique must receive distinct colors in any proper coloring, so the maximum color is a valid upper bound and pruning a branch cannot discard a larger clique. Branching tries every candidate that could extend the current clique, so at least one branch reaches a maximum clique; the recorded best is therefore the true maximum.",
        complexityRationale:
            "The coloring bound prunes most branches and makes the typical running time about O(2^(V/2)), though a worst-case instance can still force O(2^V) subsets. Vertex sets, colors, and recursion use O(V^2) space.",
        uses: [
            "Finding the largest fully connected group in social or collaboration networks",
            "A subroutine for graph coloring and scheduling feasibility tests",
            "Molecular similarity and cheminformatics clique searches",
        ],
        references: [
            "Konc and Janezic, An Improved Branch and Bound Algorithm for the Maximum Clique Problem, 2007",
            "Tomita and Seki, An Efficient Branch-and-Bound Algorithm for Finding a Maximum Clique, 2003",
        ],
        workedExample:
            "On a seven-vertex graph where A, B, C and D form a four-clique and F and G form a separate pair, coloring the degree-sorted vertices gives a bound that lets the search discard the F-G branch once a clique of size four is found, leaving {A, B, C, D} as the maximum.",
    },
    id: "maxcliquedyn",
    name: "MaxCliqueDyn Maximum Clique",
    category: "graph",
    complexity: { time: "O(2^(V/2)) typical", space: "O(V^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "E"],
            C: ["A", "B", "D", "E"],
            D: ["A", "C"],
            E: ["B", "C"],
            F: ["G"],
            G: ["F"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "sort vertices by decreasing degree",
        "greedily color the candidate set to obtain clique-size bounds",
        "while candidates remain and the bound can improve the best",
        "take the highest-color candidate and extend the current clique",
        "recolor its candidate neighborhood and recurse",
        "prune branches whose color bound cannot beat the best",
        "update the best clique whenever a larger one is completed",
        "done: report the maximum clique",
    ],
};

export default module;
