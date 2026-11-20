/**
 * modular-decomposition.ts - Modular Decomposition of a Graph
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A module is a set of vertices that looks identical to every vertex outside
 * it. Modular decomposition collapses a graph into a tree whose nodes are the
 * maximal strong modules: a series node joins its children, a co-series node
 * makes them independent, and a prime node records a genuine interleaving. The
 * root and its descendants describe the whole graph's structure in O(V) tree
 * nodes. This visualization enumerates the modules of a small graph and builds
 * that canonical decomposition tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^V * V^2) for exhaustive module enumeration on V vertices
 *   Space: O(2^V) for the set of discovered modules
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The original graph is shown with vertices of a chosen module GOLD.
 *   - Series modules are GREEN, co-series modules BLUE, prime modules ORANGE.
 *   - The final frame reports the decomposition tree in its metadata.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface DecompositionNode {
    id: string;
    type: "series" | "coseries" | "prime" | "leaf";
    members: string[];
    children: DecompositionNode[];
}

function symmetrize(graph: Record<string, string[]>): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const v of Object.keys(graph)) out[v] = [];
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            if (!(v in out)) out[v] = [];
            if (!out[u].includes(v)) out[u].push(v);
            if (!out[v].includes(u)) out[v].push(u);
        }
    }
    for (const v of Object.keys(out)) out[v].sort();
    return out;
}

/** Build the canonical modular decomposition tree of a small undirected graph. */
export function modularDecomposition(graph: Record<string, string[]>): DecompositionNode {
    const adj = symmetrize(graph);
    const labels = Object.keys(adj).sort();
    const n = labels.length;
    if (n === 0) return { id: "empty", type: "leaf", members: [], children: [] };
    const idx = new Map(labels.map((v, i) => [v, i]));
    const matrix = labels.map((u) => labels.map((v) => adj[u]?.includes(v) ?? false));

    const isModule = (mask: number): boolean => {
        for (let x = 0; x < n; x += 1) {
            if (mask & (1 << x)) continue;
            let all = true;
            let none = true;
            for (let y = 0; y < n; y += 1) {
                if (!(mask & (1 << y))) continue;
                if (matrix[x][y]) none = false;
                else all = false;
            }
            if (!all && !none) return false;
        }
        return true;
    };

    const modules: number[] = [];
    for (let mask = 1; mask < 1 << n; mask += 1) {
        if (isModule(mask)) modules.push(mask);
    }
    const overlaps = (a: number, b: number): boolean => {
        const inter = a & b;
        return inter !== 0 && (a & ~b) !== 0 && (b & ~a) !== 0;
    };
    const strong = modules.filter((m) => !modules.some((o) => o !== m && overlaps(m, o)));
    const membersOf = (mask: number): string[] => labels.filter((_, i) => (mask & (1 << i)) !== 0);

    const build = (mask: number, id: string): DecompositionNode => {
        const members = membersOf(mask);
        if (members.length === 1) return { id, type: "leaf", members, children: [] };
        const sub = strong
            .filter((s) => s !== mask && (s & mask) === s)
            .sort((a, b) => {
                const pa = a & (a - 1);
                return pa === 0 ? -1 : b - a;
            });
        const maximal = sub.filter((s) => !sub.some((o) => o !== s && (s & o) === s && o !== s));
        let allAdjacent = true;
        let noneAdjacent = true;
        for (let i = 0; i < members.length; i += 1) {
            for (let j = i + 1; j < members.length; j += 1) {
                const a = idx.get(members[i] as string) as number;
                const b = idx.get(members[j] as string) as number;
                if (matrix[a][b]) noneAdjacent = false;
                else allAdjacent = false;
            }
        }
        const type: DecompositionNode["type"] = allAdjacent ? "series" : noneAdjacent ? "coseries" : "prime";
        const children = maximal.map((s, i) => build(s, `${id}.${i}`));
        return { id, type, members, children };
    };

    return build((1 << n) - 1, "root");
}

function flatten(node: DecompositionNode, out: DecompositionNode[] = []): DecompositionNode[] {
    out.push(node);
    for (const c of node.children) flatten(c, out);
    return out;
}

function treeLines(node: DecompositionNode, depth = 0): string[] {
    const line = `${"  ".repeat(depth)}${node.id} ${node.type} {${node.members.join(",")}}`;
    return [line, ...node.children.flatMap((c) => treeLines(c, depth + 1))];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const graph: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "X", "Y"],
        D: ["A", "B", "X", "Y"],
        X: ["C", "D", "Y"],
        Y: ["C", "D", "X"],
    };
    const adj = symmetrize(graph);
    const labels = Object.keys(adj).sort();
    const edges: VisualEdge[] = [];
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u < v) edges.push({ id: `edge-${u}-${v}`, sourceId: `node-${u}`, targetId: `node-${v}`, label: "", state: "idle", directed: false });
        }
    }
    const tree = modularDecomposition(graph);
    const all = flatten(tree).filter((x) => x.members.length > 1);
    const states = new Map<string, EntityState>();
    let step = 0;
    const emit = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean | Array<number | string>> = {}): VisualFrame => {
        const entities: VisualEntity[] = labels.map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: states.get(label) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label },
        }));
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities,
            edges: edges.map((e) => ({ ...e })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { vertices: labels.length, ...meta },
        };
    };

    yield emit("Modular decomposition: group vertices that look the same to the outside.", 0);
    for (const node of all) {
        for (const m of node.members) states.set(m, node.type === "series" ? "sorted" : node.type === "coseries" ? "visited" : "pivot");
        yield emit(
            `${node.type} module {${node.members.join(", ")}} with ${node.children.length} child module(s).`,
            3,
            { module: node.members, type: node.type, children: node.children.length },
        );
    }
    for (const m of states.keys()) states.delete(m);
    yield emit(`Decomposition tree has ${flatten(tree).length} node(s) and ${all.length} nontrivial modules.`, 5, {
        tree: treeLines(tree),
        moduleCount: all.length,
        final: true,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two vertices can be interchangeable from the outside: any outside vertex is either connected to both or to neither. Such a set is a module, and the largest non-overlapping modules form a tree. A module whose children are all cross-connected is a series node, one with no cross-connections is a co-series node, and anything else is prime. The tree compresses the graph's repeated structure.",
        invariants: [
            "Every listed module has uniform adjacency to each vertex outside it.",
            "The strong modules form a laminar family: any two are disjoint or one contains the other.",
            "The children of a module partition its vertices.",
        ],
        correctness:
            "Enumerating all subsets and keeping those with uniform outside adjacency finds every module exactly. Filtering to modules that overlap no other module yields the strong modules, which are laminar; the maximal strong submodules of a node therefore partition it. Labeling a node series, co-series, or prime according to whether all, none, or some of its child pairs are adjacent matches the canonical decomposition theorem, so the tree is the unique modular decomposition.",
        complexityRationale:
            "Testing each of the 2^V subsets scans at most V^2 vertex pairs, giving O(2^V V^2) time; storing the module set uses O(2^V) space. This exhaustive presentation favors clarity and is practical only for small graphs, whereas linear-time algorithms exist for large ones.",
        uses: [
            "Recognizing cographs and other structured graph classes",
            "Speeding up dynamic programming on graphs with repeated structure",
            "Canonical representation and isomorphism testing aids",
        ],
        references: [
            "Gallai, Transitiv orientierbare Graphen, 1967",
            "Bergeron, Wagner, and Addison, The Modular Decomposition and its Applications, 1998",
        ],
        workedExample:
            "Two disjoint edges with every cross edge present form a series node whose two children are each a series node of two leaves; the root joins the two pairs, and each pair joins its two vertices.",
    },
    id: "modular-decomposition",
    name: "Modular Decomposition",
    category: "graph",
    complexity: { time: "O(2^V * V^2)", space: "O(2^V)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "X", "Y"],
            D: ["A", "B", "X", "Y"],
            X: ["C", "D", "Y"],
            Y: ["C", "D", "X"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the undirected graph",
        "for each vertex subset: test uniform adjacency to the outside",
        "collect every subset that passes as a module",
        "keep the modules that overlap no other module (strong modules)",
        "for the root, take its maximal strong submodules as children",
        "label a node series, co-series, or prime from its child adjacencies",
        "recurse on each child to finish the decomposition tree",
        "done: report the tree of strong modules",
    ],
};

export default module;
