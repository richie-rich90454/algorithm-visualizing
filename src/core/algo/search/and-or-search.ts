/**
 * and-or-search.ts - AND/OR Search on a Problem-Reduction Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AND/OR search models problem reduction. An OR node is solved as soon as one
 * child is solved, while an AND node is solved only when every child is solved.
 * The search walks the tree in order, records which nodes succeed, and returns
 * a proof tree: the successful subtrees that justify the root. It is the basis
 * of game-tree search and theorem-proving search.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) on a tree of V nodes, each visited once
 *   Space: O(V) for the outcome table and the proof tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes show OR, AND, or a solved/unsolved leaf.
 *   - The node currently being tested is GOLD; a proved node is GREEN.
 *   - A failed node is RED; untouched nodes stay gray.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SearchNode {
    id: string;
    op: "OR" | "AND" | "LEAF";
    children?: string[];
    solved?: boolean;
}

function makeEntities(
    order: string[],
    nodes: Map<string, SearchNode>,
    parent: Map<string, string>,
    states: Map<string, EntityState>,
): VisualEntity[] {
    return order.map((id) => {
        const node = nodes.get(id) as SearchNode;
        const label = node.op === "LEAF" ? `${id}:${node.solved ? "T" : "F"}` : `${id}:${node.op}`;
        return {
            id: `node-${id}`,
            type: "node" as const,
            label,
            value: id,
            state: states.get(id) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ?? "root", op: node.op },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { root?: string; nodes?: SearchNode[] } | null) ?? {};
    const list: SearchNode[] = Array.isArray(task.nodes) && task.nodes.length > 0
        ? task.nodes
        : [
              { id: "root", op: "OR", children: ["a", "b"] },
              { id: "a", op: "AND", children: ["a1", "a2"] },
              { id: "a1", op: "LEAF", solved: true },
              { id: "a2", op: "LEAF", solved: false },
              { id: "b", op: "AND", children: ["b1", "b2"] },
              { id: "b1", op: "LEAF", solved: true },
              { id: "b2", op: "LEAF", solved: true },
          ];
    const nodes = new Map(list.map((n) => [n.id, n]));
    const root = task.root ?? list[0]?.id ?? "root";
    const parent = new Map<string, string>();
    for (const n of list) for (const c of n.children ?? []) parent.set(c, n.id);

    const order: string[] = [];
    const visit = (id: string): void => {
        if (!nodes.has(id) || order.includes(id)) return;
        order.push(id);
        for (const c of nodes.get(id)?.children ?? []) visit(c);
    };
    visit(root);
    for (const n of list) visit(n.id);

    const states = new Map<string, EntityState>();
    const outcome = new Map<string, boolean>();
    const solution = new Set<string>();
    let step = 0;

    const emit = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean | Array<number | string>> = {}): VisualFrame => {
        const s = step;
        step += 1;
        return {
            stepNumber: s,
            entities: makeEntities(order, nodes, parent, states),
            edges: [],
            description,
            codeLineNumber,
            layout: "tree",
            meta: { root, ...meta },
        };
    };

    yield emit("AND/OR search: an OR node needs one solved child, an AND node needs all.", 0);

    function* solve(id: string): Generator<VisualFrame, { ok: boolean; proof: string[] }, unknown> {
        const node = nodes.get(id);
        if (!node) return { ok: false, proof: [] };
        states.set(id, "active");
        yield emit(`Visiting ${id} (${node.op}).`, 1, { node: id, op: node.op });
        if (node.op === "LEAF") {
            const ok = node.solved === true;
            outcome.set(id, ok);
            states.set(id, ok ? "path" : "error");
            yield emit(`Leaf ${id} is ${ok ? "solved" : "unsolved"}.`, 2, { node: id, solved: ok });
            return { ok, proof: ok ? [id] : [] };
        }
        const children = node.children ?? [];
        if (node.op === "OR") {
            for (const c of children) {
                const r = yield* solve(c);
                if (r.ok) {
                    outcome.set(id, true);
                    states.set(id, "path");
                    yield emit(`OR node ${id} is solved by child ${c}.`, 3, { node: id, solved: true });
                    return { ok: true, proof: [id, ...r.proof] };
                }
            }
            outcome.set(id, false);
            states.set(id, "error");
            yield emit(`OR node ${id} is unsolved: no child succeeded.`, 3, { node: id, solved: false });
            return { ok: false, proof: [] };
        }
        const proof: string[] = [id];
        let ok = children.length > 0;
        for (const c of children) {
            const r = yield* solve(c);
            if (r.ok) proof.push(...r.proof);
            else ok = false;
        }
        outcome.set(id, ok);
        states.set(id, ok ? "path" : "error");
        yield emit(`AND node ${id} is ${ok ? "solved, all children hold" : "unsolved, a child failed"}.`, 4, { node: id, solved: ok });
        return { ok, proof: ok ? proof : [] };
    }

    const result = yield* solve(root);
    const solved = result.ok;
    for (const id of result.proof) solution.add(id);
    yield emit(
        solved ? `Root proved: ${result.proof.join(", ")}.` : "Root cannot be proved from the given leaves.",
        5,
        { solved, proof: result.proof },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Many problems can be reduced to subproblems. An OR node represents a choice: proving any one child is enough. An AND node represents a conjunction: every child must be proved. AND/OR search explores these reductions in order and keeps the subtree that justifies success, which is exactly a proof or a game strategy.",
        invariants: [
            "An OR node is marked solved exactly when at least one child is solved.",
            "An AND node is marked solved exactly when all of its children are solved.",
            "The proof set contains only nodes whose outcome is solved.",
        ],
        correctness:
            "The proof is by structural induction on the reduction tree. A solved leaf is trivially proved. An OR node is proved by the first solved child together with that child's proof. An AND node is proved only when each child has a proof, and then the union of those proofs is a proof for the node. The root's result therefore matches the true value of the reduction.",
        complexityRationale:
            "On a tree each node is visited once and each edge is inspected once, so the time is O(V) and the outcome and proof tables use O(V) space. On a graph of reductions with shared subproblems, a memo table keeps the same linear bound in the number of distinct nodes.",
        uses: [
            "Game-tree search and strategy extraction",
            "Theorem proving and logic programming",
            "Planning problems expressed as goal reductions",
        ],
        references: [
            "Stuart Russell and Peter Norvig, Artificial Intelligence: A Modern Approach, Ch. 6",
            "Nils Nilsson, Problem-Solving Methods in Artificial Intelligence, 1971",
        ],
        workedExample:
            "With root OR of nodes a and b, where a is an AND of true and false, and b is an AND of true and true, node a fails, node b succeeds, and the root is proved by the path root, b, b1, b2.",
    },
    id: "and-or-search",
    name: "AND/OR Search",
    category: "searching",
    complexity: { time: "O(V)", space: "O(V)" },
    defaultInput: {
        root: "root",
        nodes: [
            { id: "root", op: "OR", children: ["a", "b"] },
            { id: "a", op: "AND", children: ["a1", "a2"] },
            { id: "a1", op: "LEAF", solved: true },
            { id: "a2", op: "LEAF", solved: false },
            { id: "b", op: "AND", children: ["b1", "b2"] },
            { id: "b1", op: "LEAF", solved: true },
            { id: "b2", op: "LEAF", solved: true },
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "solve(node): if node is a leaf return its solved flag",
        "if node is OR: try children in order",
        "if a child solves, return success with that child's proof",
        "if no child solves, return failure",
        "if node is AND: solve every child in order",
        "if all children solve, return success with all their proofs",
        "otherwise return failure",
        "done: report whether the root is proved and its proof tree",
    ],
};

export default module;
