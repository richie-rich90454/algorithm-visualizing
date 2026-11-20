/**
 * gale-bridg-it.ts - Gale's Bridg-It as a Shannon Switching Game
 *
 * Bridg-It is a connection game played on a lattice of two kinds of sites. One
 * player, Short, claims links and tries to join two opposite boundary sites;
 * the other, Cut, claims links and tries to keep them apart. The first player to
 * reach the goal wins. This is the Shannon switching game on a small graph, and
 * on a sufficiently rich lattice Short has a winning strategy by a strategy
 * stealing argument even though no explicit strategy is obvious.
 *
 * This module solves the game exactly by minimax over subsets of claimed links
 * and then replays an optimal line of play. A fixed graph of eight links keeps
 * the state space small enough to enumerate completely.
 *
 * Time O(2^links * links) for the minimax table; space O(2^links).
 *
 * Visualization: graph vertices are nodes and links are edges. Short's links
 * turn green, Cut's red, and unclaimed links remain idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface BridgItInput {
    edges?: Array<[number, number]>;
    source?: number;
    sink?: number;
}

interface Graph {
    edges: Array<[number, number]>;
    source: number;
    sink: number;
    vertices: number[];
}

const DEFAULT_EDGES: Array<[number, number]> = [
    [0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 5], [4, 5],
];

/** Determine whether the short player's claimed links join source to sink. */
function connected(graph: Graph, shortMask: number): boolean {
    const adjacency = new Map<number, number[]>();
    for (const vertex of graph.vertices) adjacency.set(vertex, []);
    graph.edges.forEach(([u, v], index) => {
        if ((shortMask & (1 << index)) === 0) return;
        adjacency.get(u)?.push(v);
        adjacency.get(v)?.push(u);
    });
    const seen = new Set<number>([graph.source]);
    const queue = [graph.source];
    while (queue.length > 0) {
        const current = queue.shift() ?? graph.source;
        if (current === graph.sink) return true;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return false;
}

/** True when Short can force a win from the given claimed-link partition. */
function shortWins(
    graph: Graph,
    shortMask: number,
    cutMask: number,
    memo: Map<string, boolean>,
): boolean {
    if (connected(graph, shortMask)) return true;
    const claimed = shortMask | cutMask;
    const free: number[] = [];
    for (let index = 0; index < graph.edges.length; index += 1) {
        if ((claimed & (1 << index)) === 0) free.push(index);
    }
    if (free.length === 0) return false;
    const key = `${shortMask},${cutMask}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const shortTurn = free.length % 2 === graph.edges.length % 2;
    const result = shortTurn
        ? free.some((index) => shortWins(graph, shortMask | (1 << index), cutMask, memo))
        : free.every((index) => shortWins(graph, shortMask, cutMask | (1 << index), memo));
    memo.set(key, result);
    return result;
}

function makeFrames(graph: Graph): { entities: VisualEntity[]; edges: (shortMask: number, cutMask: number) => VisualEdge[] } {
    const entities: VisualEntity[] = graph.vertices.map((vertex) => ({
        id: `node-${vertex}`,
        type: "node" as const,
        label: vertex === graph.source ? "S" : vertex === graph.sink ? "T" : String(vertex),
        value: vertex,
        state: (vertex === graph.source || vertex === graph.sink ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { vertex, terminal: vertex === graph.source || vertex === graph.sink },
    }));
    const edges = (shortMask: number, cutMask: number): VisualEdge[] =>
        graph.edges.map(([u, v], index) => ({
            id: `link-${index}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: String(index),
            state: ((shortMask & (1 << index)) !== 0 ? "sorted" : (cutMask & (1 << index)) !== 0 ? "error" : "idle") as EntityState,
            directed: false,
        }));
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BridgItInput | null) ?? {};
    const edges = Array.isArray(task.edges) && task.edges.length > 0 && task.edges.length <= 12
        ? task.edges.map(([u, v]) => [Number(u), Number(v)] as [number, number])
        : DEFAULT_EDGES;
    const vertices = [...new Set(edges.flat())].sort((a, b) => a - b);
    const graph: Graph = {
        edges,
        vertices,
        source: vertices.includes(Number(task.source ?? 0)) ? Number(task.source ?? 0) : (vertices[0] ?? 0),
        sink: vertices.includes(Number(task.sink ?? 5)) ? Number(task.sink ?? 5) : (vertices[vertices.length - 1] ?? 1),
    };
    const memo = new Map<string, boolean>();
    const willShortWin = shortWins(graph, 0, 0, memo);
    const view = makeFrames(graph);
    let shortMask = 0;
    let cutMask = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: view.entities,
        edges: view.edges(shortMask, cutMask),
        description: `Bridg-It on ${edges.length} links from S to T; minimax says ${willShortWin ? "Short" : "Cut"} wins with best play.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { links: edges.length, shortMask, cutMask, turn: "short", shortWins: willShortWin, moves: 0 },
    };
    step += 1;

    const total = edges.length;
    for (let move = 0; move < total; move += 1) {
        const claimed = shortMask | cutMask;
        const free: number[] = [];
        for (let index = 0; index < total; index += 1) {
            if ((claimed & (1 << index)) === 0) free.push(index);
        }
        if (free.length === 0 || connected(graph, shortMask)) break;
        const shortTurn = free.length % 2 === total % 2;
        let chosen = free[0] ?? 0;
        if (shortTurn) {
            chosen = free.find((index) => shortWins(graph, shortMask | (1 << index), cutMask, memo)) ?? chosen;
            shortMask |= 1 << chosen;
        } else {
            chosen = free.find((index) => !shortWins(graph, shortMask, cutMask | (1 << index), memo)) ?? chosen;
            cutMask |= 1 << chosen;
        }
        const winner = connected(graph, shortMask) ? "short" : move === total - 1 ? "cut" : "none";
        yield {
            stepNumber: step,
            entities: view.entities,
            edges: view.edges(shortMask, cutMask),
            description: `${shortTurn ? "Short" : "Cut"} claims link ${chosen}${winner === "short" ? " and connects S to T" : ""}.`,
            codeLineNumber: shortTurn ? 4 : 6,
            layout: "graph",
            meta: { links: total, shortMask, cutMask, turn: shortTurn ? "short" : "cut", shortWins: willShortWin, moves: move + 1, winner },
        };
        step += 1;
    }

    const finishedShort = connected(graph, shortMask);
    yield {
        stepNumber: step,
        entities: view.entities,
        edges: view.edges(shortMask, cutMask),
        description: finishedShort
            ? "Short has joined the two boundary sites and wins the switching game."
            : "All links are claimed without a connection, so Cut wins.",
        codeLineNumber: 8,
        layout: "graph",
        meta: { links: total, shortMask, cutMask, turn: "done", shortWins: willShortWin, moves: step - 1, winner: finishedShort ? "short" : "cut", completed: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A switching game is a duel between building a path and blocking every path. Each move claims one link, so the board state is just the set of links owned by each player. Because the game is finite and has no draws, minimax can decide it exactly: Short prefers any move that keeps a forced win, while Cut must find a reply that survives every one of Short's future moves.",
        invariants: [
            "A link is claimed by at most one player and is never reused.",
            "The player to move is determined by the total number of claimed links.",
            "Short wins the instant the claimed links contain a path from S to T.",
        ],
        correctness:
            "The recursion is the definition of a winning position in a finite perfect-information game: a player to move wins if some legal move leads to a position winning for them, and loses only if every legal move loses. Memoization is sound because the claimed-link masks fully determine the position. Replaying a move that the table marks as winning therefore produces a genuine forced win, and the independent exhaustive solver in the test recomputes the same verdict with a separate traversal.",
        complexityRationale:
            "There are at most two to the number of links partitions of claimed edges. For each state the solver scans every link and does a graph search over the vertices, giving O(2^links * links * vertices) time and O(2^links) memo space, which is exact for the small board used here.",
        uses: [
            "Analyzing connection games such as Hex and Bridg-It",
            "Network reliability under adversarial edge failures",
            "Teaching minimax on games without a numeric evaluation function",
        ],
        references: [
            "Shannon, Game Theory of Switching Circuits, 1952",
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays, Volume 1",
        ],
        workedExample:
            "On a ladder with two parallel rows of intermediate sites, Short opens by claiming a central link. Whatever link Cut removes, Short can extend along the alternate row and eventually reach the far side. Exhaustive minimax confirms the verdict and supplies one concrete winning line.",
    },
    id: "gale-bridg-it",
    name: "Gale's Bridg-It",
    category: "game",
    complexity: { time: "O(2^links * links * vertices)", space: "O(2^links)" },
    defaultInput: { source: 0, sink: 5 },
    visualType: "graph",
    run,
    pseudocode: [
        "build the lattice graph with two boundary sites S and T",
        "memoize the winner for every partition of claimed links",
        "if Short's links already join S to T then Short wins",
        "if no links remain then Cut wins",
        "on Short's turn try each free link for a forced win",
        "on Cut's turn require every free reply to keep the win alive",
        "replay one optimal line and draw each claim",
        "stop when a connection appears or the links run out",
        "done: report the winner and the played line",
    ],
};

export default module;
