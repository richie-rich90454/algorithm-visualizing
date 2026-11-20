/**
 * multi-probability-search.ts - Multi-Probability Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rather than committing to a single best move at every node, multi-probability
 * search keeps a distribution over all candidate moves. Each child receives a
 * probability proportional to the exponential of its backed-up value, so good
 * moves gain mass without discarding alternatives. The principal variation
 * follows the most probable child at each level, and the root value is still
 * the ordinary minimax value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) to back up values plus O(b) per node for softmax
 *   Space: O(b^d) for the stored probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes along the most probable variation are CYAN (path).
 *   - Nodes with a small probability stay GREY (unvisited).
 */

import type { AlgorithmModule, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface Task {
    leaves?: number[];
    temperature?: number;
}

function buildTree(depth: number, branch: number, id: { value: number }, parent: string | null): VisualEntity[] {
    const current = id.value;
    id.value += 1;
    const nodes: VisualEntity[] = [
        {
            id: `node-${current}`,
            type: "node",
            label: String(current),
            value: current,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent ?? "root", depth },
        },
    ];
    if (depth > 0) {
        for (let i = 0; i < branch; i += 1) nodes.push(...buildTree(depth - 1, branch, id, `node-${current}`));
    }
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const leaves = task.leaves ?? [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6];
    const temperature = Math.max(0.25, task.temperature ?? 1);
    const counter = { value: 0 };
    const nodes = buildTree(3, 3, counter, null);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const children = new Map<string, string[]>();
    for (const node of nodes) {
        const parent = String(node.metadata["parentId"]);
        const list = children.get(parent) ?? [];
        list.push(node.id);
        children.set(parent, list);
    }
    const leafIds = nodes.filter((node) => (children.get(node.id) ?? []).length === 0).map((node) => node.id);
    leafIds.forEach((id, index) => {
        const node = byId.get(id);
        if (node) node.label = String(leaves[index] ?? 0);
    });
    const root = nodes[0]?.id ?? "";

    const probabilities = new Map<string, number[]>();
    const values = new Map<string, number>();
    const evaluate = (nodeId: string, depth: number): number => {
        const kids = children.get(nodeId) ?? [];
        const node = byId.get(nodeId);
        if (kids.length === 0) {
            const value = Number(node?.label ?? 0);
            values.set(nodeId, value);
            return value;
        }
        const childValues = kids.map((child) => evaluate(child, depth + 1));
        const isMax = depth % 2 === 0;
        const best = isMax ? Math.max(...childValues) : Math.min(...childValues);
        values.set(nodeId, best);
        const weights = childValues.map((value) => Math.exp((value - best) / temperature));
        const sum = weights.reduce((a, b) => a + b, 0);
        probabilities.set(nodeId, weights.map((weight) => weight / sum));
        if (node) node.label = String(best);
        return best;
    };
    const rootValue = evaluate(root, 0);
    const variation: string[] = [];
    let cursor = root;
    for (let depth = 0; depth < 3; depth += 1) {
        const kids = children.get(cursor) ?? [];
        const probs = probabilities.get(cursor) ?? [];
        let bestIndex = 0;
        for (let i = 1; i < probs.length; i += 1) {
            if ((probs[i] as number) > (probs[bestIndex] as number)) bestIndex = i;
        }
        cursor = kids[bestIndex] ?? cursor;
        variation.push(cursor);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Multi-probability search on a ternary depth-three tree with temperature ${temperature}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { temperature, leaves: leaves.length, value: rootValue },
    };
    step += 1;

    for (let depth = 0; depth < variation.length; depth += 1) {
        for (const node of nodes) node.state = "unvisited";
        for (let i = 0; i <= depth; i += 1) {
            const node = byId.get(variation[i] as string);
            if (node) node.state = "path";
        }
        const parentId = depth === 0 ? root : (variation[depth - 1] as string);
        const probs = probabilities.get(parentId) ?? [];
        yield {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: [],
            description: `Depth ${depth}: most probable child of ${parentId} is ${variation[depth]} with probability ${(probs.reduce((max, p) => Math.max(max, p), 0)).toFixed(3)}.`,
            codeLineNumber: 4,
            layout: "tree",
            meta: {
                depth,
                node: variation[depth] as string,
                rootProbabilities: (probabilities.get(root) ?? []).map((p) => Math.round(p * 1e6) / 1e6),
                value: rootValue,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Root value ${rootValue}; the most probable variation is ${[root, ...variation].join(" -> ")}.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: {
            value: rootValue,
            optimal: rootValue,
            variation: variation.join("->"),
            rootProbabilities: (probabilities.get(root) ?? []).map((p) => Math.round(p * 1e6) / 1e6),
            temperature,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single best move hides how close the alternatives were. Multi-probability search assigns each move a soft score based on its backed-up value, turning those scores into probabilities. The most likely line becomes the principal variation, but the full distribution is available for deeper analysis or randomized play.",
        invariants: [
            "Probabilities at a node are nonnegative and sum to one.",
            "A higher backed-up value always receives at least as much probability as a lower one.",
            "The most probable child is one of the children with the best backed-up value.",
        ],
        correctness:
            "Backing up maximum at maximizing levels and minimum at minimizing levels is exactly minimax, so the root value is correct. The softmax transformation is monotone in value, so ordering moves by probability agrees with ordering them by value, and every child receives positive probability because the exponential is positive.",
        complexityRationale:
            "Each of the O(b^d) nodes stores O(b) probabilities after its children are evaluated, giving O(b^d * b) time and O(b^d * b) space in the worst case.",
        uses: [
            " ranking candidate moves with confidence scores",
            " randomized play that preserves near-optimal choices",
            " exposing alternative lines in game analysis tools",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search",
            "Sutton and Barto, Reinforcement Learning: An Introduction, softmax action selection",
        ],
        workedExample:
            "If the three children of a maximizing node have values 2, 5, and 5, the softmax at temperature one gives the first child a much smaller probability than the other two. The two best moves share the largest probabilities and the backed-up root value remains 5.",
    },
    id: "multi-probability-search",
    name: "Multi-Probability Search",
    category: "game",
    complexity: { time: "O(b^d * b)", space: "O(b^d * b)" },
    defaultInput: {
        leaves: [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
        temperature: 1,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build a depth-three game tree with the supplied leaf scores",
        "back up maximum and minimum values exactly as in minimax",
        "at each node exponentiate child values relative to the best",
        "normalize those weights into a probability per child",
        "follow the most probable child to form the principal variation",
        "highlight the variation one depth at a time",
        "report the root distribution and the chosen variation",
        "done: the minimax value together with move probabilities",
    ],
};

export default module;
