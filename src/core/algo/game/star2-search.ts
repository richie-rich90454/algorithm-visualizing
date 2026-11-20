/**
 * star2-search.ts - STAR2 Adversarial Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * STAR2 applies the null-window idea of STAR1 at MIN nodes. After the first
 * child is searched with a full window, later children are probed with the
 * window (best-1, best). A fail-low proves the child can improve the MIN
 * node, so it is searched fully; a fail-high proves it cannot and it is
 * skipped. The root value still equals plain minimax, with fewer full searches.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^d) worst case, often fewer nodes than alpha-beta
 *   Space: O(d) recursion depth
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A node being probed is YELLOW (comparing).
 *   - A node whose exact value is backed up is GREEN (sorted).
 *   - The closing frame reports the root value and probe count.
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
        : [5, 1, 6, 2, 7, 3, 8, 4];
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

    yield snap(`STAR2 on a depth-${depth} game tree with ${leaves.length} leaves; MAX moves first.`, 0, {
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
            const scout = i > 0 && !isMax;
            let value: number;
            if (!scout) {
                value = yield* ab(child, !isMax, alpha, beta);
            } else {
                // Null window at a MIN node: can this child improve the best?
                probes += 1;
                node.state = "comparing";
                const probe = yield* ab(child, !isMax, best - 1, best);
                if (probe <= best - 1) {
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
            `${isMax ? "MAX" : "MIN"} node ${node.id} backs up ${best}${!isMax && probes > 0 ? " using a STAR2 null-window probe" : ""}.`,
            4,
            { node: node.id, isMax, value: best, probes },
        );
        node.state = "sorted";
        return best;
    }

    const answer = yield* ab(root, true, -Infinity, Infinity);
    yield snap(`Done: STAR2 returns game value ${answer} with ${probes} null-window probe(s).`, 6, {
        value: answer,
        probes,
        evaluated,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "STAR2 is the mirror of STAR1: the null-window trick moves to MIN nodes. Once the first child sets a candidate, later children are tested with a window one unit wide just below that candidate. If the probe shows the child could be smaller it is searched fully; otherwise it is discarded. The value at the root is identical to minimax, but many full searches are avoided.",
        invariants: [
            "A null-window probe at a MIN node uses the window (best-1, best).",
            "A probe that fails low proves the child value is below best.",
            "A fail-high means the child cannot lower the MIN value and is skipped.",
        ],
        correctness:
            "With integer utilities, a fail-low result from the window (best-1, best) means the child's value is at most best-1, strictly better than the incumbent, so it must be searched fully. A fail-high means the child is at least best and cannot improve the MIN node, so skipping it is safe. Kept children are evaluated exactly and skipped children cannot change the minimum, making the root value equal to plain minimax.",
        complexityRationale:
            "Probes traverse subtrees as alpha-beta does, so the worst case is O(b^d), but each skip avoids a full search of an irrelevant child and typically reduces node count. The recursion uses O(d) stack space.",
        uses: [
            "Negamax and alpha-beta engines seeking extra pruning",
            "Game trees with integer heuristic scores and ordered moves",
            "A symmetric counterpart to STAR1 for teaching null windows",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search improvements",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning, 1975",
        ],
        workedExample:
            "At a MIN node whose first child scores 4, the second child is probed with window (3,4). A fail-low means its true score is at most 3, so MIN re-searches it fully and may lower the parent value. A fail-high means it scores at least 4 and is skipped.",
    },
    id: "star2-search",
    name: "STAR2 Search",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { leaves: [5, 1, 6, 2, 7, 3, 8, 4] },
    visualType: "tree",
    run,
    pseudocode: [
        "search the first child with the full window",
        "for each later child at a MIN node use a null window",
        "probe the window from best minus one to best",
        "if the probe fails low search this child fully",
        "if it fails high skip this child entirely",
        "carry the best child value up to the parent",
        "answer is the value backed up to the root",
    ],
};

export default module;
