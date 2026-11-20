/**
 * tree-contraction.ts - Parallel Tree Contraction (Rake and Compress)
 *
 * An arithmetic expression tree is evaluated in O(log n) rounds. In each
 * round every leaf is raked into its parent, and every degree-one node is
 * compressed by connecting its child directly to its parent. Both operations
 * can be applied to disjoint nodes simultaneously.
 *
 * Time: O(log n) rounds on a balanced tree. Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";

type Rule = { op: "+" | "*"; left: number; right: number };
type Task = { parentMap?: Record<string, string | null>; values?: Record<string, number>; ops?: Record<string, "+" | "*"> };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(task.parentMap ?? {
            B: "A", C: "A", D: "B", E: "B", F: "C", G: "C", H: "D", I: "E",
        }),
    );
    const values: Record<string, number> = task.values ?? {
        A: 0, B: 0, C: 0, D: 0, E: 0, F: 2, G: 3, H: 4, I: 5,
    };
    const ops: Record<string, "+" | "*"> = task.ops ?? {
        A: "+", B: "*", C: "+", D: "+", E: "*",
    };
    const ids = Object.keys(values);
    const frames: VisualFrame[] = [];
    let step = 0;
    let rounds = 0;
    let rakes = 0;
    let compressions = 0;

    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent && children.has(parent)) {
            children.get(parent)?.push(child);
        }
    }
    for (const id of ids) {
        if (ops[id]) {
            values[id] = ops[id] === "+" ? 0 : 1;
        }
    }
    const alive = new Set(ids);
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

    const snapshot = (active: string[], message: string, line: number, extra: Record<string, number | string | boolean> = {}): VisualFrame => ({
        stepNumber: step,
        entities: ids.filter((id) => alive.has(id)).map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: ops[id] ? `${id}:${ops[id]}=${values[id] ?? 0}` : `${id}=${values[id] ?? 0}`,
            value: values[id] ?? 0,
            state: (active.includes(id) ? "comparing" : id === root && alive.size === 1 ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                label: id,
                parentId: alive.has(parentMap.get(id) ?? "") ? `node-${parentMap.get(id)}` : "root",
            },
        })),
        edges: ids
            .filter((id) => alive.has(id) && alive.has(parentMap.get(id) ?? ""))
            .map((id) => ({
                id: `edge-${parentMap.get(id)}-${id}`,
                sourceId: `node-${parentMap.get(id)}`,
                targetId: `node-${id}`,
                label: "",
                state: (active.includes(id) ? "active" : "idle") as EntityState,
                directed: false,
            })),
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { vertices: alive.size, rounds, rakes, compressions, ...extra },
    });

    if (ids.length === 0) {
        frames.push(snapshot([], "Empty expression tree - no value to evaluate.", 0, { result: 0 }));
        yield* frames;
        return;
    }

    frames.push(snapshot([], `Tree contraction on ${ids.length} nodes; rake leaves and compress chains each round.`, 0));
    step += 1;

    let guard = 0;
    while (alive.size > 1 && guard < ids.length + 5) {
        guard += 1;
        rounds += 1;
        const currentUnary = [...alive].filter((id) => {
            const parent = parentMap.get(id);
            return (children.get(id) ?? []).length === 1 && parent !== null && parent !== undefined &&
                id !== root && ops[id] === ops[parent];
        });
        const currentLeaves = [...alive].filter((id) =>
            (children.get(id) ?? []).length === 0 && parentMap.get(id) !== null &&
            !currentUnary.includes(parentMap.get(id) ?? ""));

        for (const node of currentUnary) {
            if (!alive.has(node)) {
                continue;
            }
            const parent = parentMap.get(node);
            const child = (children.get(node) ?? [])[0];
            if (!parent || !child || !alive.has(parent) || !alive.has(child)) {
                continue;
            }
            const operator = ops[parent] ?? "+";
            values[parent] = operator === "+"
                ? (values[parent] ?? 0) + (values[node] ?? 0)
                : (values[parent] ?? 0) * (values[node] ?? 0);
            children.set(parent, (children.get(parent) ?? []).map((c) => (c === node ? child : c)));
            parentMap.set(child, parent);
            children.delete(node);
            alive.delete(node);
            compressions += 1;
        }
        frames.push(snapshot(currentUnary, `Round ${rounds}: compressed ${currentUnary.length} degree-one node(s) out of the chain.`, 5, { compressed: currentUnary.length }));
        step += 1;

        for (const leaf of currentLeaves) {
            const parent = parentMap.get(leaf);
            if (!parent || !alive.has(parent)) {
                continue;
            }
            const operator = ops[parent] ?? "+";
            const leafValue = values[leaf] ?? 0;
            values[parent] = operator === "+" ? (values[parent] ?? 0) + leafValue : (values[parent] ?? 0) * leafValue;
            children.set(parent, (children.get(parent) ?? []).filter((c) => c !== leaf));
            alive.delete(leaf);
            rakes += 1;
        }
        frames.push(snapshot(currentLeaves, `Round ${rounds}: raked ${currentLeaves.length} leaf value(s) into their parents.`, 3, { raked: currentLeaves.length }));
        step += 1;

        if (currentLeaves.length === 0 && currentUnary.length === 0) {
            break;
        }
    }

    frames.push(snapshot([root], `Contraction finished with value ${values[root] ?? 0} after ${rounds} round(s).`, 7, {
        result: values[root] ?? 0,
        rounds,
    }));
    yield* frames;
}

const module: AlgorithmModule = {
    id: "tree-contraction",
    name: "Tree Contraction (Rake and Compress)",
    category: "tree",
    complexity: { time: "O(log n) rounds", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "C", H: "D", I: "E" },
        values: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 2, G: 3, H: 4, I: 5 },
        ops: { A: "+", B: "*", C: "+", D: "+", E: "*" },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build child lists and mark every node alive",
        "while more than one node remains",
        "rake every leaf into its parent using the parent operator",
        "remove the raked leaves from the live tree",
        "compress each degree-one node by linking its child to its parent",
        "remove the compressed node from the live tree",
        "repeat until a single root value remains",
        "report the evaluated expression",
    ],
    education: {
        intuition:
            "Tree contraction evaluates an expression tree by shrinking it in parallel rounds. All leaves can be folded into their parents at once, and all one-child nodes can be bypassed at once. Because roughly a constant fraction of the tree disappears each round, a balanced tree finishes in logarithmic time.",
        invariants: [
            "The value of a live subtree equals the value of the original subtree it represents.",
            "Raking a leaf never changes the operator stored at its parent.",
            "Compressing a unary plus or times node preserves the represented expression.",
        ],
        correctness:
            "Raking a leaf applies exactly the operation its parent would have performed when evaluating that child, so the parent's stored value absorbs the child's contribution. A unary plus or multiplication node is an identity on its single child, so bypassing it preserves the expression. Repeating these local rewrites until one node remains leaves that node holding the full expression value.",
        complexityRationale:
            "Each round rakes all leaves and compresses all degree-one nodes in one parallel sweep; a balanced tree loses a constant fraction of its nodes per round, giving O(log n) rounds. The child lists and value table use O(n) space.",
        uses: [
            "Parallel evaluation of expression trees",
            "Eyre-Dyer-Williamson tree contraction primitives",
            "Parallel algorithms for tree and graph problems",
        ],
        references: [
            "Shiloach and Vishkin, An O(log n) Parallel Connectivity Algorithm, 1982",
            "Blelloch, Introduction to Parallel Algorithms, tree contraction chapter",
        ],
        workedExample:
            "For the tree with root plus, left subtree times of 4 and 5, and right subtree plus of 2 and 3, the first rake folds the four leaves into their parents, the next rake folds those parents into the root, and compression removes leftover one-child nodes. The root ends with 20 plus 5 = 25.",
    },
};

export default module;
