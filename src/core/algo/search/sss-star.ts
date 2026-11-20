/**
 * sss-star.ts - SSS* Best-First Game-Tree Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SSS* (Stockman, 1979) computes the minimax value of a game tree with a
 * best-first state-space search rather than the depth-first sweep of alpha-
 * beta. It keeps an OPEN list of states (node, LIVE/SOLVED, bound h) ordered
 * by decreasing h. LIVE interior nodes are expanded (all children at MAX,
 * the first child at MIN); a terminal becomes SOLVED with min(h, leaf value).
 * When a node is SOLVED it is backed up: a solved MIN closes its MAX parent
 * and purges the parent's other branches, while a solved MAX either opens
 * its next sibling or closes its MIN parent. The search ends when the root
 * itself becomes SOLVED, and its h is the game value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) OPEN-list operations for n visited states; in practice
 *          far fewer leaves than a full minimax sweep
 *   Space: O(n) for the OPEN list and the set of solved states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The game tree is drawn with a tree layout; leaves show their utility.
 *   - The node currently popped from OPEN is highlighted.
 *   - Nodes that have been solved are green; unvisited nodes stay idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/** A raw game tree: a number is a leaf utility, otherwise a MAX/MIN node. */
type RawNode = number | { type: "max" | "min"; children: RawNode[] };

interface Node {
    key: string;
    path: number[];
    type: "max" | "min" | "terminal";
    value: number;
    children: Node[];
}

interface State {
    path: number[];
    s: "L" | "S";
    h: number;
    seq: number;
}

interface Event {
    focus: string;
    h: number;
    open: State[];
    desc: string;
    line: number;
    answer: number | null;
}

const INF = 1e9;

/** Build indexed nodes with dot-decimal paths from a nested raw tree. */
function build(raw: RawNode, path: number[]): Node {
    if (typeof raw === "number") {
        return { key: path.join("."), path, type: "terminal", value: raw, children: [] };
    }
    const node: Node = {
        key: path.join("."),
        path,
        type: raw.type === "min" ? "min" : "max",
        value: 0,
        children: [],
    };
    node.children = raw.children.map((child, i) => build(child, [...path, i + 1]));
    return node;
}

/** Gather every node of a tree in left-to-right order. */
function flatten(root: Node): Node[] {
    const out: Node[] = [];
    const visit = (n: Node): void => {
        out.push(n);
        for (const c of n.children) visit(c);
    };
    visit(root);
    return out;
}

/** OPEN ordering: highest bound first, then left-most path, then insertion. */
function byMerit(a: State, b: State): number {
    if (a.h !== b.h) return b.h - a.h;
    const n = Math.min(a.path.length, b.path.length);
    for (let i = 0; i < n; i += 1) {
        if (a.path[i] !== b.path[i]) return a.path[i]! - b.path[i]!;
    }
    return a.path.length - b.path.length || a.seq - b.seq;
}

function startsWith(path: number[], prefix: number[]): boolean {
    return prefix.every((value, i) => path[i] === value);
}

/** Execute SSS* and record one event per OPEN-list pop. */
function search(root: Node): { events: Event[]; answer: number } {
    const nodes = flatten(root);
    const byPath = new Map<string, Node>();
    for (const n of nodes) byPath.set(n.key, n);

    const events: Event[] = [];
    let open: State[] = [];
    let seq = 0;
    const push = (path: number[], s: "L" | "S", h: number): void => {
        open.push({ path: [...path], s, h, seq: seq++ });
    };
    let answer = 0;

    push(root.path, "L", INF);

    for (let expansions = 0; expansions < 20000; expansions += 1) {
        open.sort(byMerit);
        const p = open.shift();
        if (!p) break;
        const node = byPath.get(p.path.join("."));
        if (!node) continue;

        if (p.path.length === 1 && p.s === "S") {
            answer = p.h;
            events.push({
                focus: node.key,
                h: p.h,
                open: [...open],
                desc: `Root solved: the minimax value of the game tree is ${p.h}.`,
                line: 8,
                answer,
            });
            break;
        }

        let desc = "";
        let line = 0;
        if (p.s === "L") {
            if (node.type === "terminal") {
                push(p.path, "S", Math.min(p.h, node.value));
                desc = `Leaf ${node.key} has utility ${node.value}; store SOLVED bound ${Math.min(p.h, node.value)}.`;
                line = 2;
            } else if (node.type === "min") {
                push([...p.path, 1], "L", p.h);
                desc = `MIN node ${node.key}: open its first child only.`;
                line = 3;
            } else {
                for (let j = 1; j <= node.children.length; j += 1) {
                    push([...p.path, j], "L", p.h);
                }
                desc = `MAX node ${node.key}: open all ${node.children.length} child(ren).`;
                line = 4;
            }
        } else {
            // A solved child of a MAX node closes that parent and purges its
            // other branches; a solved child of a MIN node opens its next
            // sibling (or closes the parent when it is the last child).
            const parent = p.path.slice(0, -1);
            const parentNode = byPath.get(parent.join("."));
            const childOfMax = parentNode?.type === "max";
            if (childOfMax) {
                push(parent, "S", p.h);
                open = open.filter(
                    (st) => !(st.path.length > parent.length && startsWith(st.path, parent)),
                );
                desc = `Node ${node.key} solved: close MAX parent ${parent.join(".")} and purge its open branches.`;
                line = 5;
            } else {
                const k = p.path[p.path.length - 1]!;
                if (!parentNode || k >= parentNode.children.length) {
                    push(parent, "S", p.h);
                    desc = `Node ${node.key} solved and is the last child: close parent ${parent.join(".")}.`;
                    line = 6;
                } else {
                    push([...parent, k + 1], "L", p.h);
                    desc = `Node ${node.key} solved: open the next sibling ${[...parent, k + 1].join(".")}.`;
                    line = 7;
                }
            }
        }

        events.push({
            focus: node.key,
            h: p.h,
            open: [...open],
            desc,
            line,
            answer: null,
        });
    }

    return { events, answer };
}

/** Build drawable tree entities for one SSS* event. */
function makeEntities(nodes: Node[], ev: Event): VisualEntity[] {
    const solved = new Set<string>();
    for (const st of ev.open) {
        if (st.s === "S") solved.add(st.path.join("."));
    }
    if (ev.answer !== null) solved.add("1");
    return nodes.map((n) => {
        let state: EntityState = "idle";
        if (n.key === ev.focus) state = "active";
        if (solved.has(n.key)) state = "sorted";
        return {
            id: `node-${n.key}`,
            type: "node" as const,
            label: n.type === "terminal" ? String(n.value) : n.type.toUpperCase(),
            value: n.type === "terminal" ? n.value : n.type,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                parentId: n.path.length === 1 ? "root" : `node-${n.path.slice(0, -1).join(".")}`,
                nodeType: n.type,
            },
        };
    });
}

function makeEdges(nodes: Node[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const n of nodes) {
        if (n.path.length === 1) continue;
        edges.push({
            id: `edge-${n.key}`,
            sourceId: `node-${n.path.slice(0, -1).join(".")}`,
            targetId: `node-${n.key}`,
            label: n.type === "terminal" ? String(n.value) : "",
            state: "idle",
            directed: false,
        });
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { tree?: RawNode } | null) ?? {};
    const raw: RawNode = task.tree ?? {
        type: "max",
        children: [
            {
                type: "min",
                children: [5, { type: "max", children: [8, 3] }],
            },
            {
                type: "min",
                children: [{ type: "max", children: [7, 4] }, 6],
            },
        ],
    };
    const root = build(raw, [1]);
    const nodes = flatten(root);
    const edges = makeEdges(nodes);
    const result = search(root);

    let step = 0;
    for (const ev of result.events) {
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, ev),
            edges,
            description: ev.desc,
            codeLineNumber: ev.line,
            layout: "tree",
            meta: {
                bound: Number.isFinite(ev.h) ? ev.h : INF,
                openCount: ev.open.length,
                focus: ev.focus,
                answer: ev.answer ?? -1,
            },
        };
        step += 1;
    }
}

/** The SSS* game-tree search module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Alpha-beta explores a game tree from the top down in a fixed order. SSS* instead keeps a to-do list of partial solutions ranked by how promising they look, and always works on the best one. It grows a 'max solution tree' and repeatedly refines an upper bound on the game value, stopping only when it has proved the root's value.",
        invariants: [
            "OPEN is ordered by a nonincreasing bound h, so its head is the best current upper bound.",
            "A LIVE node's bound is an upper bound on the true minimax value of its subtree.",
            "A SOLVED node's bound is exact for the part of the tree explored below it.",
            "The bound at the head of OPEN never increases as the search refines the solution tree.",
        ],
        correctness:
            "At a MAX node all children are opened, so the max solution tree includes every way MAX can move; at a MIN node only the first child is opened, so the tree is a max solution tree whose value is an upper bound that expanding more MIN children can only lower. Solving a MIN node closes its MAX parent and purges the other branches because they can no longer improve the bound; solving a MAX node exposes its next sibling or closes its MIN parent. When the root is SOLVED its bound is an upper bound that no remaining branch can lower, which is exactly the minimax value.",
        complexityRationale:
            "Each iteration pops one state and pushes a constant number (or all children at a MAX node), with OPEN kept sorted, so the work is O(log n) per state for O(n) visited states. The OPEN list and solved set hold at most O(n) states, giving O(n) space.",
        uses: [
            "Exact solving of two-player zero-sum games such as chess endgames",
            "Best-first adversarial search where a good move ordering is unavailable",
            "A theoretical benchmark for comparing alpha-beta pruning variants",
        ],
        references: [
            "Stockman, A Best-First Fixdepth Search Algorithm (SSS*), 1979",
            "Pearl, Asymptotics of Pruning in Game-Tree Search, 1984",
        ],
        workedExample:
            "For a MAX root with two MIN children whose leaves are 8 and 3, and 7 and 4, SSS* first opens the left tree and records upper bound 8. It then solves the left MIN child to 3 (its smallest leaf), lowers the bound, and repeats on the right child to get 4. The root takes the larger of 3 and 4, so the root solves to 4, matching ordinary minimax.",
    },
    id: "sss-star",
    name: "SSS* Best-First Search",
    category: "searching",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        tree: {
            type: "max",
            children: [
                { type: "min", children: [5, { type: "max", children: [8, 3] }] },
                { type: "min", children: [{ type: "max", children: [7, 4] }, 6] },
            ],
        },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "OPEN ← {(root, LIVE, +infinity)}",
        "pop the state p with the largest bound from OPEN",
        "if p is a terminal, push (p, SOLVED, min(bound, leaf value))",
        "if p is a LIVE MIN node, push its first child LIVE",
        "if p is a LIVE MAX node, push all its children LIVE",
        "if p is a SOLVED MIN node, solve its parent and purge siblings",
        "if p is a SOLVED MAX node with no next sibling, solve its parent",
        "otherwise push the next sibling of that MAX node LIVE",
        "stop when the root is SOLVED and return its bound",
    ],
};

export default module;
