/**
 * star1-search.ts - STAR1 Adversarial Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * STAR1 speeds up alpha-beta at MAX nodes. After the first child is searched
 * with a full window, each later child is probed with a null window just wide
 * enough to answer one question: can it beat the best value found so far? A
 * probe that fails low proves the child cannot help and skips the full search;
 * a probe that fails high triggers the full search to recover the exact value.
 * The backed-up root value is the same as plain minimax.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) worst case, fewer nodes than alpha-beta in practice
 *   Space: O(d) recursion depth
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A node being probed is YELLOW (comparing).
 *   - A node whose exact value is backed up is GREEN (sorted).
 *   - The root's final value is shown in the closing frame.
 */
import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GNode {
    id: number;
    isLeaf: boolean;
    leafIndex: number;
    left?: GNode;
    right?: GNode;
    parentId: string;
    label: string;
    state: "unvisited" | "comparing" | "visited" | "sorted" | "active";
}

function buildTree(depth: number, parentId: string, counter: { n: number }, leaf: { n: number }): GNode {
    const id = counter.n++;
    const node: GNode = {
        id,
        isLeaf: depth === 0,
        leafIndex: depth === 0 ? leaf.n++ : -1,
        parentId,
        label: "?",
        state: "unvisited",
    };
    if (depth > 0) {
        node.left = buildTree(depth - 1, `gn-${id}`, counter, leaf);
        node.right = buildTree(depth - 1, `gn-${id}`, counter, leaf);
    }
    return node;
}

function render(nodes: GNode[]): VisualEntity[] {
    return nodes.map((node) => ({
        id: `gn-${node.id}`,
        type: "node" as const,
        label: node.label,
        value: node.label,
        state: node.state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: node.parentId, leaf: node.isLeaf },
    }));
}

function collect(root: GNode): GNode[] {
    const out: GNode[] = [];
    const walk = (n: GNode): void => {
        out.push(n);
        if (n.left) walk(n.left);
        if (n.right) walk(n.right);
    };
    walk(root);
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    const leaves = Array.isArray(task.leaves) && task.leaves.length > 0
        ? task.leaves.map(Number)
        : [3, 5, 2, 6, 1, 4, 7, 2];
    const depth = Math.max(1, Math.round(Math.log2(leaves.length)));
    const counter = { n: 0 };
    const leafCounter = { n: 0 };
    const root = buildTree(depth, "root", counter, leafCounter);
    const nodes = collect(root);
    let step = 0;
    let probes = 0;
    let evaluated = 0;

    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean> = {}): VisualFrame => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: render(nodes),
            edges: [],
            description,
            codeLineNumber,
            layout: "tree",
            meta,
        };
        step += 1;
        return frame;
    };

    yield snap(`STAR1 on a depth-${depth} game tree with ${leaves.length} leaves; MAX moves first.`, 0, {
        leaves: leaves.length,
    });

    function* ab(node: GNode, isMax: boolean, alpha: number, beta: number): Generator<VisualFrame, number, unknown> {
        if (node.isLeaf) {
            const value = leaves[node.leafIndex] ?? 0;
            node.label = String(value);
            node.state = "visited";
            evaluated += 1;
            yield snap(`Leaf ${node.id} reveals utility ${value}.`, 2, { node: node.id, value });
            return value;
        }
        const children = [node.left, node.right].filter((c): c is GNode => !!c);
        let best = isMax ? -Infinity : Infinity;
        for (let i = 0; i < children.length; i += 1) {
            const child = children[i] as GNode;
            const scout = i > 0 && isMax;
            let value: number;
            if (!scout) {
                value = yield* ab(child, !isMax, alpha, beta);
            } else {
                // Null window at a MAX node: does this child beat the best?
                probes += 1;
                node.state = "comparing";
                const probe = yield* ab(child, !isMax, best, best + 1);
                if (probe >= best + 1) {
                    value = yield* ab(child, !isMax, alpha, beta);
                } else {
                    continue;
                }
            }
            best = isMax ? Math.max(best, value) : Math.min(best, value);
            if (isMax ? best >= beta : best <= alpha) break;
            if (isMax) alpha = Math.max(alpha, best);
            else beta = Math.min(beta, best);
        }
        node.label = String(best);
        node.state = "comparing";
        evaluated += 1;
        yield snap(
            `${isMax ? "MAX" : "MIN"} node ${node.id} backs up ${best}${isMax && probes > 0 ? " using a STAR1 null-window probe" : ""}.`,
            4,
            { node: node.id, isMax, value: best, probes },
        );
        node.state = "sorted";
        return best;
    }

    const answer = yield* ab(root, true, -Infinity, Infinity);
    yield snap(`Done: STAR1 returns game value ${answer} with ${probes} null-window probe(s).`, 6, {
        value: answer,
        probes,
        evaluated,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "At a MAX node, only the first child needs a full-window search to establish a candidate value. For each later child STAR1 asks a cheaper yes-or-no question using a window one unit wide: is this child strictly better than the current best? A no answer lets the search skip that child; a yes answer triggers the full search. The answer is unchanged because the cheap question is exhaustive for integer scores.",
        invariants: [
            "A null-window probe at a MAX node uses the window (best, best+1).",
            "A probe that fails low proves the child value is at most best.",
            "Full-window re-search after a fail-high restores the exact child value.",
        ],
        correctness:
            "For integer utilities, a fail-low result from the window (best, best+1) means the child's value is at most best, so it cannot improve the MAX node and skipping it is safe. A fail-high means the child is strictly better, and re-searching with the full window returns its exact value. Every skipped child is therefore irrelevant and every kept child contributes its true minimax value, so the root equals plain minimax.",
        complexityRationale:
            "A null-window probe still walks a subtree, so the worst case remains the full O(b^d) tree, but probes prune subtrees that cannot beat the incumbent, typically visiting far fewer nodes. Recursion stores one frame per level, O(d) space.",
        uses: [
            "Game engines that need alpha-beta with fewer full searches",
            "Adversarial search with ordered moves and integer evaluations",
            "A teaching bridge from alpha-beta to scout and MTD(f)",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search improvements",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning, 1975",
        ],
        workedExample:
            "At a MAX node whose first child scores 4, the second child is probed with window (4,5). If it fails low its true score is at most 4 and it is skipped. If it fails high it must score at least 5, so a full search recovers the exact number before MAX decides.",
    },
    id: "star1-search",
    name: "STAR1 Search",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2] },
    visualType: "tree",
    run,
    pseudocode: [
        "search the first child with the full window",
        "for each later child at a MAX node use a null window",
        "probe the window from best to best plus one",
        "if the probe fails low skip this child entirely",
        "if it fails high search the child with the full window",
        "carry the best child value up to the parent",
        "answer is the value backed up to the root",
    ],
};

export default module;
