/**
 * eagle-decoding.ts - EAGLE Speculative Draft-Tree Verification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * EAGLE speeds up autoregressive decoding by drafting a tree of candidate
 * continuations from the previous hidden features, then asking the target model
 * to verify many branches in a single pass. Every drafted token is accepted
 * only if it equals the target's greedy prediction in that context, and the
 * target supplies one extra bonus token after the accepted prefix. A longer
 * accepted branch means more tokens produced per target call.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(B) target predictions for B drafted nodes in the tree
 *   Space: O(B) for the tree and the accepted chain
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each drafted node is a cell placed at its tree depth.
 *   - Accepted nodes are green, rejected nodes red, unexplored nodes idle.
 *   - Frame meta records the accepted chain, bonus token, and final sequence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DraftNode {
    id: number;
    parent: number;
    token: number;
}

interface EagleInput {
    prompt?: number[];
    nodes?: DraftNode[];
    targetMap?: Record<string, number>;
}

/** Verify every branch of a draft tree and keep the longest accepted chain. */
export function verifyDraftTree(
    nodes: DraftNode[],
    prompt: number[],
    targetNext: (context: number[]) => number,
): { accepted: number[]; tokens: number[]; bonus: number; sequence: number[]; visited: number[] } {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const children = new Map<number, DraftNode[]>();
    const roots: DraftNode[] = [];
    for (const node of nodes) {
        if (node.parent < 0) {
            roots.push(node);
            continue;
        }
        const list = children.get(node.parent) ?? [];
        list.push(node);
        children.set(node.parent, list);
    }
    const visited: number[] = [];
    let bestNodes: number[] = [];
    let bestTokens: number[] = [];
    const walk = (node: DraftNode, chainNodes: number[], chainTokens: number[]): void => {
        visited.push(node.id);
        const context = [...prompt, ...chainTokens];
        if (targetNext(context) !== node.token) return;
        const nextNodes = [...chainNodes, node.id];
        const nextTokens = [...chainTokens, node.token];
        if (nextNodes.length > bestNodes.length) {
            bestNodes = nextNodes;
            bestTokens = nextTokens;
        }
        for (const child of children.get(node.id) ?? []) {
            walk(child, nextNodes, nextTokens);
        }
    };
    for (const root of roots) {
        walk(root, [], []);
    }
    const bonus = targetNext([...prompt, ...bestTokens]);
    return {
        accepted: bestNodes,
        tokens: bestTokens,
        bonus,
        sequence: [...prompt, ...bestTokens, bonus],
        visited,
    };
}

/** Build the greedy target function from a context-to-token lookup table. */
export function makeTargetFromMap(map: Record<string, number>): (context: number[], promptLength: number) => number {
    return (context, promptLength) => {
        const key = context.slice(promptLength).join(",");
        return map[key] ?? (context.reduce((sum, t) => sum + t, 0) % 10);
    };
}

/** Plain records for frame meta. */
function metaNodes(nodes: DraftNode[]): Array<Record<string, number>> {
    return nodes.map((node) => ({ id: node.id, parent: node.parent, token: node.token }));
}

function makeCells(nodes: DraftNode[], accepted: number[], visited: number[]): VisualEntity[] {
    const depthOf = (node: DraftNode): number => {
        let depth = 0;
        let parent = node.parent;
        const seen = new Set<number>([node.id]);
        while (parent >= 0 && !seen.has(parent)) {
            seen.add(parent);
            depth += 1;
            parent = nodes.find((n) => n.id === parent)?.parent ?? -1;
        }
        return depth;
    };
    return nodes.map((node, col) => {
        let state: EntityState = "idle";
        if (accepted.includes(node.id)) state = "sorted";
        else if (visited.includes(node.id)) state = "error";
        return {
            id: `node-${node.id}`,
            type: "cell" as const,
            label: `${node.token}`,
            value: node.token,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: depthOf(node), col, parent: node.parent, token: node.token },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EagleInput | null) ?? {};
    const prompt = (task.prompt ?? [0]).map(Number);
    const nodes: DraftNode[] = (task.nodes ?? [
        { id: 0, parent: -1, token: 1 },
        { id: 1, parent: 0, token: 2 },
        { id: 2, parent: 0, token: 5 },
        { id: 3, parent: 1, token: 3 },
        { id: 4, parent: 2, token: 7 },
        { id: 5, parent: 3, token: 8 },
    ]).map((n) => ({ id: n.id, parent: n.parent, token: n.token }));
    const targetMap = task.targetMap ?? {
        "": 1,
        "1": 2,
        "1,2": 3,
        "1,2,3": 8,
        "1,2,3,8": 9,
    };
    const targetFromMap = makeTargetFromMap(targetMap);
    const targetNext = (context: number[]): number => targetFromMap(context, prompt.length);
    const result = verifyDraftTree(nodes, prompt, targetNext);
    const maxDepth = Math.max(0, ...nodes.map((node) => {
        let depth = 0;
        let parent = node.parent;
        while (parent >= 0) {
            depth += 1;
            parent = nodes.find((n) => n.id === parent)?.parent ?? -1;
        }
        return depth;
    }));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(nodes, [], []),
        edges: [],
        description: `EAGLE drafted ${nodes.length} candidate tokens in a tree of depth ${maxDepth}; verification begins.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: maxDepth + 1, cols: nodes.length, nodes: metaNodes(nodes), accepted: [], visited: [], sequence: prompt },
    };
    step += 1;

    const visitedSoFar: number[] = [];
    const acceptedSoFar: number[] = [];
    for (const id of result.visited) {
        if (result.accepted.includes(id)) acceptedSoFar.push(id);
        visitedSoFar.push(id);
        yield {
            stepNumber: step,
            entities: makeCells(nodes, acceptedSoFar, visitedSoFar),
            edges: [],
            description: `Checked node ${id} drafted token ${nodes.find((n) => n.id === id)?.token}; accepted chain length ${acceptedSoFar.length}.`,
            codeLineNumber: step === 1 ? 2 : 4,
            layout: "grid",
            meta: { rows: maxDepth + 1, cols: nodes.length, nodes: metaNodes(nodes), accepted: [...acceptedSoFar], visited: [...visitedSoFar] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(nodes, result.accepted, result.visited),
        edges: [],
        description: `Accepted ${result.tokens.length} drafted token(s) plus bonus ${result.bonus}; emitted ${result.sequence.length - prompt.length} token(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: maxDepth + 1,
            cols: nodes.length,
            nodes: metaNodes(nodes),
            accepted: result.accepted,
            visited: result.visited,
            tokens: result.tokens,
            bonus: result.bonus,
            sequence: result.sequence,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Speculative decoding guesses several future tokens, then checks the guesses in one target-model call. EAGLE makes those guesses a tree of branches rather than one flat chain, using hidden features to propose each branch. Verification walks the tree and keeps the longest branch whose tokens agree with the target, so a single call can emit many tokens.",
        invariants: [
            "A drafted token is accepted only when it equals the target's greedy output for the exact prefix leading to it.",
            "The accepted nodes form one root-to-leaf chain in the draft tree.",
            "One bonus token from the target is appended after the accepted prefix.",
        ],
        correctness:
            "For each branch the verifier replays the target prediction with the branch's own accumulated context, so acceptance is decided against the correct conditional distribution. Keeping the longest accepted chain maximizes tokens emitted, and appending the target's next-token prediction after that chain produces exactly the sequence the target would generate greedily, so the output distribution is unchanged.",
        complexityRationale:
            "Every drafted node is compared at most once, so verification costs O(B) target predictions for B nodes, and the tree plus accepted chain use O(B) space.",
        uses: [
            "Accelerating large language model inference without changing outputs",
            "Low-latency on-device text generation",
            "Tree-based search over candidate continuations",
        ],
        references: [
            "Li, Wei, Chen et al., EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty, ICML 2024",
            "Leviathan, Kalman, Matias, Fast Inference from Transformers via Speculative Decoding, ICML 2023",
        ],
        workedExample:
            "With prompt [0], the draft root token 1 matches the target's first prediction. Its child 2 and grandchild 3 also match, while the sibling 5 does not. Four tokens including the target bonus are emitted in one verification pass instead of four separate decoding steps.",
    },
    id: "eagle-decoding",
    name: "EAGLE Speculative Decoding",
    category: "ml-ai",
    complexity: { time: "O(B)", space: "O(B)" },
    defaultInput: {
        prompt: [0],
        nodes: [
            { id: 0, parent: -1, token: 1 },
            { id: 1, parent: 0, token: 2 },
            { id: 2, parent: 0, token: 5 },
            { id: 3, parent: 1, token: 3 },
            { id: 4, parent: 2, token: 7 },
            { id: 5, parent: 3, token: 8 },
        ],
        targetMap: { "": 1, "1": 2, "1,2": 3, "1,2,3": 8, "1,2,3,8": 9 },
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build the draft tree of candidate token nodes",
        "for each root child start an empty accepted chain",
        "predict the target token for the current prefix",
        "accept the drafted token when it matches the prediction",
        "descend to that node's child and repeat",
        "stop a branch at the first mismatch",
        "keep the longest accepted chain and add the target bonus token",
        "done: return the verified output sequence",
    ],
};

export default module;
