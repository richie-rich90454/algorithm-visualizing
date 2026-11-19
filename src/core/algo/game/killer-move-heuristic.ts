/**
 * killer-move-heuristic.ts - Killer-Move Move Ordering in Alpha-Beta
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A killer move is a quiet move that caused a cutoff at a particular search
 * ply. Alpha-beta stores the last two killers per ply and tries them before
 * the remaining quiet moves when it later searches a sibling position at the
 * same ply. Better ordering prunes more of the tree, but it never changes the
 * minimax value because every skipped branch is already refuted by the bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(nodes visited after pruning), worst case O(b^d)
 *   Space: O(b^d) for the displayed tree plus O(d) for the killer table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The search tree is drawn as nodes joined by labeled move edges.
 *   - The node being resolved is highlighted; its refuting edge is red.
 *   - Edges that are currently stored as killers turn green.
 *   - Limits: complete trees up to depth 5 and branching factor 4.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type SearchEvent = {
    path: string;
    ply: number;
    maximizing: boolean;
    moveOrder: number[];
    cutoffMove: number;
    value: number;
    killerAtPly: string;
    visited: number;
};

function buildLeaves(depth: number, branch: number, seed: number): number[] {
    const count = branch ** depth;
    const leaves: number[] = [];
    let state = seed >>> 0 || 1;
    for (let i = 0; i < count; i += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        leaves.push((state % 21) - 10);
    }
    return leaves;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        leaves?: number[];
        depth?: number;
        branch?: number;
        seed?: number;
    } | null) ?? {};
    const depth = Math.max(1, Math.min(5, Math.floor(task.depth ?? 3)));
    const branch = Math.max(2, Math.min(4, Math.floor(task.branch ?? 3)));
    const seed = Math.floor(task.seed ?? 7);
    const leaves = task.leaves?.length === branch ** depth
        ? task.leaves.slice()
        : buildLeaves(depth, branch, seed);

    const nodeIds: string[] = [""];
    const edgeSpecs: { parent: string; child: string; move: number }[] = [];
    for (let ply = 0; ply < depth; ply += 1) {
        const parents = nodeIds.filter((p) => p.length === ply);
        for (const parent of parents) {
            for (let move = 0; move < branch; move += 1) {
                const child = parent + String(move);
                nodeIds.push(child);
                edgeSpecs.push({ parent, child, move });
            }
        }
    }

    const leafIndex = (path: string): number => {
        let index = 0;
        for (let pos = 0; pos < path.length; pos += 1) {
            index = index * branch + Number(path[pos]);
        }
        return index;
    };

    const killerTable: number[][] = Array.from({ length: depth + 1 }, () => []);
    const events: SearchEvent[] = [];
    let visited = 0;

    const recordKiller = (ply: number, move: number): void => {
        const slot = killerTable[ply] ?? [];
        const next = [move, ...slot.filter((m) => m !== move)].slice(0, 2);
        killerTable[ply] = next;
    };

    const orderedMoves = (ply: number): number[] => {
        const killers = (killerTable[ply] ?? []).filter((m) => m >= 0 && m < branch);
        const rest: number[] = [];
        for (let m = 0; m < branch; m += 1) {
            if (!killers.includes(m)) rest.push(m);
        }
        return [...killers, ...rest];
    };

    const search = (path: string, ply: number, alpha: number, beta: number, maximizing: boolean): number => {
        visited += 1;
        if (ply === depth) return leaves[leafIndex(path)] ?? 0;
        const order = orderedMoves(ply);
        let value = maximizing ? -Infinity : Infinity;
        let cutoffMove = -1;
        let a = alpha;
        let b = beta;
        for (const move of order) {
            const childValue = search(path + String(move), ply + 1, a, b, !maximizing);
            if (maximizing) {
                if (childValue > value) value = childValue;
                if (value > a) a = value;
                if (a >= b) {
                    if (move % 2 === 0) recordKiller(ply, move);
                    cutoffMove = move;
                    break;
                }
            } else {
                if (childValue < value) value = childValue;
                if (value < b) b = value;
                if (a >= b) {
                    if (move % 2 === 0) recordKiller(ply, move);
                    cutoffMove = move;
                    break;
                }
            }
        }
        events.push({
            path,
            ply,
            maximizing,
            moveOrder: order,
            cutoffMove,
            value,
            killerAtPly: (killerTable[ply] ?? []).join(","),
            visited,
        });
        return value;
    };

    const finalValue = search("", 0, -Infinity, Infinity, true);
    const cutoffs = events.filter((e) => e.cutoffMove >= 0).length;

    const makeEntities = (focusPath: string, killers: number[]): VisualEntity[] => {
        const active = new Set(killers.map((k) => `edge-${focusPath}-${k}`));
        const nodes = nodeIds.map((path) => {
            const isLeaf = path.length === depth;
            const state: EntityState = path === focusPath ? "comparing" : isLeaf ? "visited" : "idle";
            return {
                id: `n-${path}`,
                type: "node" as const,
                label: isLeaf ? String(leaves[leafIndex(path)] ?? 0) : path === "" ? "root" : `p${path.length}`,
                value: isLeaf ? (leaves[leafIndex(path)] ?? 0) : path,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: {
                    row: path.length,
                    col: path === "" ? 0 : Number(path[path.length - 1]),
                    parentId: path === "" ? "root" : `n-${path.slice(0, -1)}`,
                    isLeaf,
                },
            };
        });
        return nodes;
    };

    const makeEdges = (focusPath: string, focusMove: number, killers: number[]): VisualEdge[] =>
        edgeSpecs.map((spec) => {
            const isKiller = spec.parent === focusPath && killers.includes(spec.move);
            const isCutoff = spec.parent === focusPath && spec.move === focusMove;
            const state: EntityState = isCutoff ? "error" : isKiller ? "sorted" : "idle";
            return {
                id: `e-${spec.parent}-${spec.move}`,
                sourceId: `n-${spec.parent}`,
                targetId: `n-${spec.parent}${spec.move}`,
                label: `m${spec.move}${spec.move % 2 === 0 ? "" : "*"}`,
                state,
                directed: true,
            };
        });

    const frameFor = (step: number, event: SearchEvent | null, codeLine: number): VisualFrame => {
        const path = event?.path ?? "";
        const focusMove = event?.cutoffMove ?? -1;
        const killers = event ? (event.killerAtPly === "" ? [] : event.killerAtPly.split(",").map(Number)) : (killerTable[0] ?? []);
        return {
            stepNumber: step,
            entities: makeEntities(path, killers),
            edges: makeEdges(path, focusMove, killers),
            description: event
                ? `Ply ${event.ply} ${event.maximizing ? "max" : "min"} node ${path || "root"}: tried moves [${event.moveOrder.join(", ")}], value ${event.value}${focusMove >= 0 ? `, quiet move m${focusMove} became a killer` : ", no cutoff"}.`
                : `Killer-move alpha-beta on a depth-${depth}, branching-${branch} tree; ${cutoffs} quiet cutoffs recorded.`,
            codeLineNumber: codeLine,
            layout: "tree",
            meta: {
                depth,
                branch,
                ply: event?.ply ?? 0,
                moveOrder: event?.moveOrder ?? [],
                cutoffMove: focusMove,
                killerAtPly: event?.killerAtPly ?? (killerTable[0] ?? []).join(","),
                nodeValue: event?.value ?? finalValue,
                visited: event?.visited ?? visited,
                cutoffs,
                finalValue,
            },
        };
    };

    let step = 0;
    yield frameFor(step++, null, 0);
    for (const event of events) {
        yield frameFor(step++, event, event.cutoffMove >= 0 ? 5 : 3);
    }
    yield {
        stepNumber: step,
        entities: makeEntities("", killerTable[0] ?? []).map((e) =>
            e.id === "n-" ? { ...e, state: "sorted" as EntityState } : e,
        ),
        edges: makeEdges("", -1, killerTable[0] ?? []).map((e) => ({ ...e, state: "idle" as EntityState })),
        description: `Search finished with value ${finalValue}; ${visited} node(s) visited and ${cutoffs} killer cutoff(s) recorded.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { depth, branch, visited, cutoffs, finalValue, converged: true, killerAtPly: (killerTable[0] ?? []).join(",") },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A quiet move that refuted a whole branch once is likely to refute a similar branch nearby. Alpha-beta stores the two most recent such moves at each ply and tries them first in later sibling positions. This changes only the order in which children are searched, so the final value is unchanged while more branches get pruned.",
        invariants: [
            "At most two killer moves are kept per ply, and only quiet moves are stored.",
            "Every skipped branch is refuted by the current alpha or beta bound.",
            "The returned value equals plain minimax on the same tree.",
        ],
        correctness:
            "The killer table only reorders children; it never removes a child from consideration unless alpha-beta has already proved that child cannot affect the parent value. A quiet cutoff move is stored at the ply where it caused the bound to close, and the same bound argument applies when that move is tried first at a sibling node. Because the set of examined values is unchanged up to pruned refutations, the root value equals the unpruned minimax value.",
        complexityRationale:
            "The work is proportional to the number of nodes actually visited after pruning, which is O(b^d) in the worst case and closer to O(b^(d/2)) with effective ordering. The tree display costs one node and edge per position, and the killer table holds two moves per ply, O(d) space.",
        uses: [
            "Move ordering inside chess and other game-tree engines",
            "Reducing node counts in alpha-beta search with transposition tables",
            "Teaching how search order affects pruning without affecting correctness",
        ],
        references: [
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning, Artificial Intelligence 6 (1975)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, chapter 5",
        ],
        workedExample:
            "At ply two a quiet move m2 raises beta enough to cut off the node, so m2 becomes that ply's killer. When the next sibling at ply two is searched, m2 is tried before m0 and m1. If it cuts off again the value is unchanged, but two child subtrees are never visited.",
    },
    id: "killer-move-heuristic",
    name: "Killer Move Heuristic",
    category: "game",
    complexity: { time: "O(nodes after pruning)", space: "O(b^d + d)" },
    defaultInput: { depth: 3, branch: 3, seed: 7 },
    visualType: "tree",
    run,
    pseudocode: [
        "build the move tree with quiet and tactical edges",
        "initialize an empty killer table for every ply",
        "order a node's moves with this ply's killers first",
        "recursively evaluate each move with alpha and beta bounds",
        "test whether the bound closes after this move",
        "on a quiet cutoff store the move as a killer for this ply",
        "return the backed-up value to the parent",
        "repeat until the root is resolved",
        "report the final value and the recorded killer moves",
    ],
};

export default module;
