/**
 * dulmage-mendelsohn-decomposition.ts - Dulmage-Mendelsohn Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a maximum matching in a bipartite graph, the Dulmage-Mendelsohn
 * decomposition sorts the matched edges by how essential they are. Orient
 * matched edges from right to left and unmatched edges from left to right.
 * Matched edges reachable from a free left vertex can be replaced by an
 * alternating path; matched edges that can reach a free right vertex can also
 * be swapped away; matched edges inside an alternating cycle are flexible;
 * the remaining matched edges belong to every maximum matching.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E) for the Kuhn matching plus O(V * (V + E)) reachability
 *   Space: O(V^2 + E) for the reachability sets and the graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Forced edges are GREEN (sorted); flexible edges are PINK or YELLOW.
 *   - Unmatched edges stay idle, and the edge being classified is BLUE.
 *   - Vertices touched by the current class are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { kuhnMatching } from "./kuhn-matching";

interface DmInput {
    left?: string[];
    right?: string[];
    edges?: Array<[string, string]>;
}

type ClassName = "forced" | "underdetermined" | "overdetermined" | "cyclic";

const CLASS_LABEL: Record<ClassName, string> = {
    forced: "forced in every maximum matching",
    underdetermined: "replaceable from a free left vertex",
    overdetermined: "replaceable toward a free right vertex",
    cyclic: "flexible inside an alternating cycle",
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DmInput | null) ?? {};
    const left = Array.isArray(task.left) && task.left.length > 0 ? task.left : ["A", "B", "C", "D"];
    const right = Array.isArray(task.right) && task.right.length > 0 ? task.right : ["1", "2", "3", "4"];
    const edgeList: Array<[string, string]> = Array.isArray(task.edges)
        ? task.edges
        : [
              ["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"],
              ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"],
          ];

    const nodes: VisualEntity[] = [
        ...left.map((label) => ({
            id: `node-L-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { side: "left", label },
        })),
        ...right.map((label) => ({
            id: `node-R-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { side: "right", label },
        })),
    ];
    const edges: VisualEdge[] = edgeList.map(([l, r], index) => ({
        id: `edge-${index}`,
        sourceId: `node-L-${l}`,
        targetId: `node-R-${r}`,
        label: "",
        state: "idle" as const,
        directed: false,
    }));

    const result = kuhnMatching(left, right, edgeList);
    const matched = new Set(result.matchedPairs.map(([l, r]) => `${l}|${r}`));
    const matchedLeft = new Set(result.matchedPairs.map(([l]) => l));
    const matchedRight = new Set(result.matchedPairs.map(([, r]) => r));

    const lKey = (l: string): string => `L:${l}`;
    const rKey = (r: string): string => `R:${r}`;
    const vertices = [...left.map(lKey), ...right.map(rKey)];
    const directed = new Map<string, string[]>(vertices.map((v) => [v, []]));
    for (const [l, r] of edgeList) {
        if (matched.has(`${l}|${r}`)) {
            directed.get(rKey(r))?.push(lKey(l));
        } else {
            directed.get(lKey(l))?.push(rKey(r));
        }
    }

    const reach = new Map<string, Set<string>>();
    for (const start of vertices) {
        const seen = new Set<string>();
        const queue = [start];
        while (queue.length > 0) {
            const current = queue.shift() as string;
            for (const next of directed.get(current) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next);
                    queue.push(next);
                }
            }
        }
        reach.set(start, seen);
    }

    const underdetermined = new Set<string>();
    for (const l of left) {
        if (!matchedLeft.has(l)) {
            for (const v of reach.get(lKey(l)) ?? []) {
                underdetermined.add(v);
            }
        }
    }
    const overdetermined = new Set<string>();
    for (const r of right) {
        if (!matchedRight.has(r)) {
            for (const v of vertices) {
                if (reach.get(v)?.has(rKey(r))) {
                    overdetermined.add(v);
                }
            }
        }
    }

    const classes: Array<{ pair: [string, string]; index: number; name: ClassName }> = [];
    edgeList.forEach(([l, r], index) => {
        if (!matched.has(`${l}|${r}`)) {
            return;
        }
        let name: ClassName;
        if (underdetermined.has(lKey(l))) {
            name = "underdetermined";
        } else if (overdetermined.has(rKey(r))) {
            name = "overdetermined";
        } else if (reach.get(lKey(l))?.has(rKey(r))) {
            name = "cyclic";
        } else {
            name = "forced";
        }
        classes.push({ pair: [l, r], index, name });
    });

    const stateFor = (name: ClassName): EntityState =>
        name === "forced" ? "sorted" : name === "cyclic" ? "comparing" : "path";

    const frame = (
        description: string,
        codeLineNumber: number,
        focus: number,
        meta: Record<string, number | string | boolean | string[]>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge, index) => ({
            ...edge,
            state: index === focus ? "active" : "idle",
        })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    let step = 0;
    yield frame(
        `Maximum matching has ${result.matchingSize} edge(s); orient matched edges right-to-left, others left-to-right.`,
        0,
        -1,
        { matchingSize: result.matchingSize, left: left.length, right: right.length, edges: edgeList.length },
    );
    step += 1;

    for (const entry of classes) {
        const [l, r] = entry.pair;
        yield frame(
            `Matched edge ${l}-${r} is ${CLASS_LABEL[entry.name]}.`,
            entry.name === "forced" ? 4 : 3,
            entry.index,
            { matchingSize: result.matchingSize, classification: entry.name, leftVertex: l, rightVertex: r },
        );
        step += 1;
    }

    const counts: Record<ClassName, number> = { forced: 0, underdetermined: 0, overdetermined: 0, cyclic: 0 };
    for (const entry of classes) {
        counts[entry.name] += 1;
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({
            ...node,
            state: "visited" as EntityState,
        })),
        edges: edges.map((edge) => {
            const entry = classes.find((c) => c.index === Number(edge.id.replace("edge-", "")));
            return { ...edge, state: entry ? stateFor(entry.name) : ("idle" as EntityState) };
        }),
        description: `Dulmage-Mendelsohn: ${counts.forced} forced, ${counts.underdetermined} underdetermined, ${counts.overdetermined} overdetermined, ${counts.cyclic} cyclic matched edge(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: {
            matchingSize: result.matchingSize,
            forced: counts.forced,
            underdetermined: counts.underdetermined,
            overdetermined: counts.overdetermined,
            cyclic: counts.cyclic,
            classes: classes.map((c) => `${c.pair[0]}-${c.pair[1]}:${c.name}`),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "After finding a maximum bipartite matching, not all matched pairs are equally certain. Orient the graph so matched edges point back from right to left and unmatched edges point forward. Alternating reachability then tells which pairs can be swapped away, which are trapped in a cycle, and which appear in every maximum matching.",
        invariants: [
            "Reversing an alternating path from a free left vertex preserves the matching size.",
            "Reversing an alternating path toward a free right vertex also preserves the size.",
            "A matched edge is forced exactly when no such path or alternating cycle contains it.",
        ],
        correctness:
            "Every alternating path that starts and ends at free vertices on opposite sides produces another maximum matching missing the matched edges on it, which is exactly what reachability from free left vertices and reachability toward free right vertices detect. An alternating cycle likewise swaps its matched edges. If none of these structures contains a matched edge, deleting it would leave an augmenting path, contradicting maximumity, so it is forced.",
        complexityRationale:
            "Kuhn's matching costs O(V times E). Computing reachability from every vertex over the directed graph costs O(V times (V + E)), which dominates; the stored reachability sets use O(V^2) space.",
        uses: [
            "Analyzing which assignments are fixed in a bipartite matching problem",
            "Structural rank analysis of sparse matrices",
            "Detecting essential edges in resource allocation and scheduling",
        ],
        references: [
            "Dulmage and Mendelsohn, Coverings of Bipartite Graphs, Canadian Journal of Mathematics, 1958",
            "Lovasz and Plummer, Matching Theory, Chapter on the DM decomposition",
        ],
        workedExample:
            "With left A,B and right 1,2 and edges A-1, A-2, B-1, the maximum matching has size two. If the matching picks A-2 and B-1 there are no free vertices on either side, so both edges are forced; with a free left vertex, an alternating path can shift the matching and those edges become underdetermined.",
    },
    id: "dulmage-mendelsohn-decomposition",
    name: "Dulmage-Mendelsohn Decomposition",
    category: "graph",
    complexity: { time: "O(V * (V + E))", space: "O(V^2 + E)" },
    defaultInput: {
        left: ["A", "B", "C", "D"],
        right: ["1", "2", "3", "4"],
        edges: [
            ["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"],
            ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "find a maximum matching with augmenting paths",
        "orient matched edges right to left and unmatched edges left to right",
        "mark vertices reachable from every free left vertex",
        "mark vertices that can reach a free right vertex",
        "for each matched edge check reachability for an alternating cycle",
        "label the edge forced, underdetermined, overdetermined, or cyclic",
        "done: report the counts for each part of the decomposition",
    ],
};

export default module;
