/**
 * graph-canonization.ts - Canonical Labeling by Exhaustive Permutation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A canonical form is a unique encoding of an unlabeled graph: two isomorphic
 * graphs must produce exactly the same string. This teaching implementation
 * tries every permutation of the vertices and keeps the lexicographically
 * smallest upper-triangular adjacency bit string. That string, together with
 * the permutation that achieved it, is the canonical labeling.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n! * n^2) - one adjacency scan per permutation
 *   Space: O(n^2) for the adjacency sets and the best encoding
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each improved labeling is shown with its permutation in YELLOW.
 *   - The final frame shows the winning canonical order in GREEN.
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualFrame } from "@/types";
import { makeGraphNodes, makeGraphEdges } from "./graph-util";

type Adjacency = Record<string, string[]>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adjacency } | null) ?? {};
    const graph: Adjacency = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C"],
    };
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [from, targets] of Object.entries(graph)) {
        for (const to of targets) {
            if (from === to || !sets.has(from) || !sets.has(to)) continue;
            sets.get(from)?.add(to);
            sets.get(to)?.add(from);
        }
    }
    const n = labels.length;
    const nodes = makeGraphNodes(n > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(Object.fromEntries([...sets].map(([v, s]) => [v, [...s]])));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
        for (const edge of edges) edge.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    if (n === 0 || n > 8) {
        yield snap(
            n === 0
                ? "Empty graph - the canonical form is the empty string."
                : "More than eight vertices: exhaustive canonization is skipped here.",
            0,
            { canonical: "", permutationTried: 0, vertices: n },
        );
        return;
    }

    yield snap(
        `Canonicalizing ${n} vertices by trying every one of the ${n} factorial labelings.`,
        0,
        { vertices: n, edges: edges.length / 2 },
    );
    step += 1;

    let best = "1".repeat(n * n);
    let bestOrder: string[] = [];
    let tried = 0;
    const used = new Array<boolean>(n).fill(false);
    const current: string[] = [];
    let improvements = 0;
    const improved: Array<{ bits: string; order: string[] }> = [];

    const visit = (depth: number): void => {
        if (depth === n) {
            tried += 1;
            let bits = "";
            for (let i = 0; i < n; i += 1) {
                const a = current[i] as string;
                for (let j = i + 1; j < n; j += 1) {
                    const b = current[j] as string;
                    bits += sets.get(a)?.has(b) ? "1" : "0";
                }
            }
            if (bits < best) {
                best = bits;
                bestOrder = [...current];
                improvements += 1;
                if (improvements <= 24) improved.push({ bits, order: [...current] });
            }
            return;
        }
        for (let i = 0; i < n; i += 1) {
            if (used[i]) continue;
            used[i] = true;
            current.push(labels[i] as string);
            visit(depth + 1);
            current.pop();
            used[i] = false;
        }
    };
    visit(0);

    for (const item of improved) {
        reset();
        item.order.forEach((label, index) => {
            const node = byId.get(`node-${label}`);
            if (node) {
                node.state = index === 0 ? "comparing" : "highlight";
                node.label = `${label}${index + 1}`;
            }
        });
        yield snap(
            `New smallest encoding ${item.bits} from order ${item.order.join(", ")}.`,
            5,
            { canonical: item.bits, order: item.order.join(","), improvements },
        );
        step += 1;
    }

    reset();
    for (const node of nodes) node.label = String(node.value);
    for (const label of bestOrder) {
        const node = byId.get(`node-${label}`);
        if (node) node.state = "sorted";
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Canonical order ${bestOrder.join(", ")} encodes as ${best} after ${tried} permutation(s).`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            canonical: best,
            order: bestOrder.join(","),
            permutations: tried,
            improvements,
            edges: best.split("1").length - 1,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An unlabeled graph has no fixed vertex names, so a canonical form renames the vertices in a deterministic way. This implementation enumerates every renaming and keeps the smallest adjacency bit string, which depends only on the graph's structure and not on the original labels.",
        invariants: [
            "Only permutations of the original vertex set are considered.",
            "The stored canonical string is the smallest one seen so far.",
            "The upper-triangular adjacency bits fully describe an undirected graph.",
        ],
        correctness:
            "Every candidate string encodes the same graph under some renaming, so the minimum over all permutations is a graph invariant. If two graphs are isomorphic, their sets of permutation encodings are identical and therefore their minima match; the winning permutation reconstructs a graph isomorphic to the input.",
        complexityRationale:
            "There are n factorial permutations and each requires scanning roughly n squared vertex pairs, giving O(n! n^2) time. The adjacency sets and the current best string use O(n^2) space.",
        uses: [
            " testing graph isomorphism in chemical structure databases",
            " deduplicating molecular graphs in cheminformatics",
            " producing stable graph identifiers in version control",
        ],
        references: [
            "Read and Corneil, The Graph Isomorphism Disease (1977)",
            "McKay, Practical Graph Isomorphism (1981)",
        ],
        workedExample:
            "For the path A-B, B-C, C-D, the labeling A, B, C, D encodes the pairs as 1, 1, 1, 0, 0, 0, giving the string 111000. Any relabeling that is isomorphic produces the same minimum string, while a non-isomorphic graph cannot.",
    },
    id: "graph-canonization",
    name: "Graph Canonization (Exhaustive)",
    category: "graph",
    complexity: { time: "O(n! * n^2)", space: "O(n^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the input into an undirected adjacency structure",
        "initialize the best encoding to the largest possible bit string",
        "for every permutation of the vertex set in lexicographic order",
        "write the upper-triangular adjacency bits for that permutation",
        "if the encoding is smaller, save it and its permutation",
        "mark the new best permutation on the graph",
        "done: the invariant canonical string and its labeling",
    ],
};

export default module;
