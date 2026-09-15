/**
 * node-kayles.ts – Node Kayles (vertex-deletion game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Node Kayles picks a vertex; the vertex and its neighbors vanish. The
 * player unable to pick loses. Simply: take the center to split the graph
 * into small dead piles. Formally: positions are solved by bitmask
 * recursion with memoization, and on the default path P5 the winning pick
 * is the center v2, leaving two isolated singles that form a P-position.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) game states
 *   Space: O(2^n) memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Live vertices paint GREEN (sorted); removed vertices go idle.
 *   - The winning pick flashes YELLOW (comparing).
 *   - The remaining components show the P-position handed over.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Impartial vertex game; last pick wins.
 *   - Picking a vertex deletes its closed neighborhood.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodeWin(mask: number, adj: number[][], memo: Map<number, boolean>): boolean {
    const hit = memo.get(mask);
    if (hit !== undefined) return hit;
    for (let v = 0; v < adj.length; v += 1) {
        if (!(mask & (1 << v))) continue;
        let nmask = mask & ~(1 << v);
        for (const w of adj[v] ?? []) nmask &= ~(1 << w);
        if (!nodeWin(nmask, adj, memo)) {
            memo.set(mask, true);
            return true;
        }
    }
    memo.set(mask, false);
    return false;
}

function nodeCells(count: number, alive: Set<number>, hot = -1): VisualEntity[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: alive.has(i) ? `v${i}` : "",
        value: alive.has(i) ? 1 : 0,
        state: (!alive.has(i) ? "unvisited" : i === hot ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number } | null) ?? {};
    const count =
        typeof task.vertices === "number" && task.vertices >= 0
            ? Math.min(7, Math.floor(task.vertices))
            : 5;
    const adj: number[][] = Array.from({ length: count }, (_, i) =>
        [i - 1, i + 1].filter((j) => j >= 0 && j < count),
    );
    const memo = new Map<number, boolean>();
    const full = count === 0 ? 0 : (1 << count) - 1;
    const winning = count === 0 ? false : nodeWin(full, adj, memo);
    let step = 0;
    const alive = new Set(Array.from({ length: count }, (_, i) => i));
    yield {
        stepNumber: step,
        entities: nodeCells(count, alive),
        edges: [],
        description: `Node Kayles on path graph P${count} with ${count} live vertices – the player to move ${winning ? "wins (N-position)" : "loses (P-position)"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { vertices: count, winning, winner: winning ? "first" : "second" },
    };
    step += 1;
    let pick = -1;
    if (winning) {
        for (let v = 0; v < count; v += 1) {
            let nmask = full & ~(1 << v);
            for (const w of adj[v] ?? []) nmask &= ~(1 << w);
            if (!nodeWin(nmask, adj, memo)) {
                pick = v;
                break;
            }
        }
    }
    if (pick < 0) {
        yield {
            stepNumber: step,
            entities: nodeCells(count, alive),
            edges: [],
            description:
                "Every vertex pick leaves the opponent a winning reply – a P-position for the player to move.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { vertices: count, winning: false, winner: "second" },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: nodeCells(count, alive),
            edges: [],
            description: `Node Kayles on P${count} with ${count} vertices is losing for the player to move.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { vertices: count, winning: false, winner: "second" },
        };
        return;
    }
    const removed = new Set([pick, ...(adj[pick] ?? [])]);
    yield {
        stepNumber: step,
        entities: nodeCells(count, alive, pick),
        edges: [],
        description: `Winning pick: vertex v${pick} deletes its neighborhood ${[...removed]
            .sort((a, b) => a - b)
            .map((v) => `v${v}`)
            .join(", ")} from path P${count}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { vertices: count, pick, winning: true },
    };
    step += 1;
    const rest = new Set([...alive].filter((v) => !removed.has(v)));
    yield {
        stepNumber: step,
        entities: nodeCells(count, rest),
        edges: [],
        description: `Remaining ${rest.size} vertices ${[...rest].map((v) => `v${v}`).join(", ") || "none"} form losing components for the player to move – a P-position.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { vertices: count, remaining: [...rest], winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: nodeCells(count, rest),
        edges: [],
        description: `First player wins Node Kayles on P${count} by taking center vertex v${pick}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { vertices: count, winning: true, winner: "first", pick },
    };
}

const module: AlgorithmModule = {
    id: "node-kayles",
    name: "Node Kayles",
    category: "game",
    complexity: { time: "O(2^n)", space: "O(2^n)" },
    defaultInput: { vertices: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from path graph P5 with all 5 vertices live",
        "a move picks one live vertex and deletes its closed neighborhood",
        "solve positions by bitmask recursion with memoization",
        "if every pick leaves a winning reply: losing P-position",
        "else highlight the center pick leaving two losing singles",
        "winner is the first player via the center vertex deletion",
    ],
};

export default module;
