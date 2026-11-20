/**
 * binary-decision-diagram.ts - Reduced Ordered Binary Decision Diagram
 *
 * A ROBDD represents a Boolean function as a rooted, ordered decision DAG
 * with two terminal leaves. Shannon expansion splits on each variable in a
 * fixed order; reduction then deletes nodes whose two children coincide and
 * merges structurally identical nodes via hash consing. The result is a
 * canonical representation: equal functions have equal diagrams.
 *
 * Time:  O(2^k) for k variables (one node per distinct cofactor)
 * Space: O(2^k)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

export interface BDDNode {
    id: number;
    variable: number; // -1 for the two terminals
    low: number;
    high: number;
}

/** Build a reduced ordered BDD from a big-endian truth table. */
export function buildBDD(truth: number[]): { nodes: BDDNode[]; root: number; levels: number } {
    let levels = 0;
    while (2 ** levels < Math.max(1, truth.length)) levels += 1;
    const table = Array.from({ length: 2 ** levels }, (_, i) => (truth[i] ? 1 : 0));
    const nodes: BDDNode[] = [
        { id: 0, variable: -1, low: 0, high: 0 },
        { id: 1, variable: -1, low: 1, high: 1 },
    ];
    const unique = new Map<string, number>();
    const mk = (variable: number, low: number, high: number): number => {
        if (low === high) return low;
        const key = `${variable}:${low}:${high}`;
        const found = unique.get(key);
        if (found !== undefined) return found;
        const id = nodes.length;
        nodes.push({ id, variable, low, high });
        unique.set(key, id);
        return id;
    };
    const build = (level: number, index: number): number => {
        if (level === levels) return table[index] ?? 0;
        const low = build(level + 1, index * 2);
        const high = build(level + 1, index * 2 + 1);
        return mk(level, low, high);
    };
    const root = build(0, 0);
    return { nodes, root, levels };
}

/** Evaluate a BDD on a full assignment, returning 0 or 1. */
export function evalBDD(nodes: BDDNode[], root: number, bits: number[]): number {
    let current = root;
    let guard = 0;
    while (guard <= bits.length) {
        const node = nodes[current];
        if (!node || node.variable < 0) return current;
        const bit = bits[node.variable] ?? 0;
        current = bit === 1 ? node.high : node.low;
        guard += 1;
    }
    return current;
}

/** True when no decision node has equal children and no two nodes are duplicates. */
export function isReduced(nodes: BDDNode[]): boolean {
    const seen = new Set<string>();
    for (const node of nodes) {
        if (node.variable < 0) continue;
        if (node.low === node.high) return false;
        const key = `${node.variable}:${node.low}:${node.high}`;
        if (seen.has(key)) return false;
        seen.add(key);
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { truthTable?: number[]; query?: number[] } | null) ?? {};
    const truth = Array.isArray(task.truthTable)
        ? task.truthTable
        : [0, 0, 0, 1]; // AND of two variables
    const { nodes, root, levels } = buildBDD(truth);
    const query = Array.isArray(task.query) && task.query.length === levels
        ? task.query.map((b) => (b ? 1 : 0))
        : Array.from({ length: levels }, () => 0);
    let step = 0;
    let path = new Set<number>();

    const snapshot = (message: string, line: number, result: number | null): VisualFrame => {
        const parent = new Map<number, string>();
        const entities: VisualEntity[] = nodes.map((node) => {
            const id = `bd-${node.id}`;
            const isTerminal = node.variable < 0;
            return {
                id,
                type: "node" as const,
                label: isTerminal ? String(node.id) : `x${node.variable}`,
                value: node.id,
                state: (path.has(node.id)
                    ? "path"
                    : isTerminal
                      ? "sorted"
                      : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    parentId: parent.get(node.id) ?? "root",
                    terminal: isTerminal,
                    variable: node.variable,
                },
            };
        });
        const edges: VisualEdge[] = [];
        for (const node of nodes) {
            if (node.variable < 0) continue;
            if (!parent.has(node.low)) parent.set(node.low, `bd-${node.id}`);
            if (!parent.has(node.high)) parent.set(node.high, `bd-${node.id}`);
            edges.push({
                id: `bd-low-${node.id}`,
                sourceId: `bd-${node.id}`,
                targetId: `bd-${node.low}`,
                label: "0",
                state: "idle" as EntityState,
                directed: true,
            });
            edges.push({
                id: `bd-high-${node.id}`,
                sourceId: `bd-${node.id}`,
                targetId: `bd-${node.high}`,
                label: "1",
                state: "idle" as EntityState,
                directed: true,
            });
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: {
                variables: levels,
                nodes: nodes.filter((nd) => nd.variable >= 0).length,
                reduced: isReduced(nodes),
                result: result === null ? "pending" : result,
            },
        };
    };

    yield snapshot(`Truth table [${truth.join(",")}] expands over ${levels} variable(s).`, 0, null);
    step += 1;
    let current = root;
    path = new Set([root]);
    yield snapshot(`Root is node ${root} after Shannon expansion and reduction.`, 2, null);
    step += 1;

    let guard = 0;
    while (guard <= query.length) {
        const node = nodes[current];
        if (!node || node.variable < 0) break;
        const bit = query[node.variable] ?? 0;
        current = bit === 1 ? node.high : node.low;
        path = new Set([root, current]);
        yield snapshot(
            `Variable x${node.variable} = ${bit}: follow ${bit === 1 ? "high" : "low"} to node ${current}.`,
            4,
            null,
        );
        step += 1;
        guard += 1;
    }

    yield snapshot(
        `Assignment [${query.join(",")}] evaluates to ${current}; diagram has ${isReduced(nodes) ? "no" : "a"} reducible node(s).`,
        6,
        current,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A binary decision diagram is a branching program for a Boolean function: at each node you read one variable and take the zero or one edge. If variables are always tested in the same order and the graph is reduced, the structure is unique for a given function, which makes equality and many Boolean operations fast.",
        invariants: [
            "Variables are tested in a fixed order along every root-to-terminal path.",
            "No decision node has identical low and high children.",
            "No two decision nodes share the same variable and child pair (hash-consed uniqueness).",
        ],
        correctness:
            "Shannon expansion states f = (not x and f|x=0) or (x and f|x=1), so recursively expanding every variable yields a diagram that evaluates to the truth-table value for each assignment. Removing redundant nodes and merging equal nodes cannot change any evaluation because those nodes return the same subfunction on every input.",
        complexityRationale:
            "In the worst case a function of k variables needs one node per distinct cofactor, at most 2^(k+1), so build time and space are exponential in k but often tiny in practice. Evaluation follows one path and costs O(k).",
        uses: [
            "Formal verification and model checking of circuit designs",
            "Symbolic Boolean manipulation in logic synthesis",
            "Compact representation of monotone and hardware functions",
        ],
        references: [
            "Randal E. Bryant, 'Graph-Based Algorithms for Boolean Function Manipulation', IEEE TC 1986",
            "Fabio Somenzi, 'Binary Decision Diagrams' in Decision Procedures, 2015",
        ],
        workedExample:
            "The two-variable AND truth table [0,0,0,1] expands on x0 then x1. Nodes with equal children collapse to the 0 terminal, leaving a single decision node x0 whose low edge is 0 and whose high edge is node x1. Evaluating assignment [1,1] follows both high edges and returns 1.",
    },
    id: "binary-decision-diagram",
    name: "Binary Decision Diagram",
    category: "data-structures",
    complexity: { time: "O(2^k) build, O(k) evaluate", space: "O(2^k)" },
    defaultInput: { truthTable: [0, 0, 0, 1], query: [1, 1] },
    visualType: "tree",
    run,
    pseudocode: [
        "represent the two Boolean terminals as nodes zero and one",
        "expand the function on the first unused variable",
        "recurse on the zero and one cofactors",
        "skip a node when its two children are identical",
        "reuse an existing node with the same variable and children",
        "return the root of the reduced ordered diagram",
        "evaluate an assignment by following low and high edges",
        "done: report the Boolean result and the node count",
    ],
};

export default module;
