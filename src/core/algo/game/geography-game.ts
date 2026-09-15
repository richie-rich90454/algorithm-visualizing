/**
 * geography-game.ts – Geography (directed vertex-path game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Geography moves a token along unused directed edges; revisiting a vertex
 * is illegal and the stuck player loses. Simply: move where the opponent
 * runs out of fresh roads. Formally: positions are solved by depth-first
 * search with memoization, and start A is losing because both replies B and
 * C reach the dead end D, while the demo line A to B to D strands the mover.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^n) game-tree search
 *   Space: O(n) recursion and visited set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The token cell flashes YELLOW (comparing); visited cells highlight.
 *   - Unvisited cells stay idle; the stranded end shows the losing line.
 *   - The verdict names the N-position or P-position status of the start.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Directed Geography is PSPACE-complete in general.
 *   - The player with no unused outgoing edge loses.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const NODES = ["A", "B", "C", "D"];
const EDGES: Record<string, string[]> = { A: ["B", "C"], B: ["D"], C: ["D"], D: [] };

function geoWin(node: string, visited: Set<string>, memo: Map<string, boolean>): boolean {
    const k = `${node}|${[...visited].sort().join("")}`;
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    for (const next of EDGES[node] ?? []) {
        if (visited.has(next)) continue;
        const nv = new Set(visited);
        nv.add(next);
        if (!geoWin(next, nv, memo)) {
            memo.set(k, true);
            return true;
        }
    }
    memo.set(k, false);
    return false;
}

function geoCells(token: string, visited: Set<string>): VisualEntity[] {
    return NODES.map((n, i) => ({
        id: `cell-${n}`,
        type: "cell" as const,
        label: n,
        value: n === token ? 2 : visited.has(n) ? 1 : 0,
        state: (n === token ? "comparing" : visited.has(n) ? "highlight" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: string } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const memo = new Map<string, boolean>();
    const winning = geoWin(start, new Set([start]), memo);
    let step = 0;
    yield {
        stepNumber: step,
        entities: geoCells(start, new Set([start])),
        edges: [],
        description: `Geography on directed map A to B,C then B to D and C to D, token at ${start} – player to move ${winning ? "wins (N-position)" : "loses (P-position)"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { start, winning, winner: winning ? "first" : "second" },
    };
    step += 1;
    // ponytail: one illustrative legal line; full game-tree search when analysis input exists.
    const line = start === "A" ? ["A", "B", "D"] : [start, ...(EDGES[start] ?? [])].slice(0, 2);
    const visited = new Set<string>([line[0] as string]);
    for (let i = 1; i < line.length; i += 1) {
        visited.add(line[i] as string);
        yield {
            stepNumber: step,
            entities: geoCells(line[i] as string, visited),
            edges: [],
            description: `Token travels directed edge ${line[i - 1]} to ${line[i]}, marking ${line[i]} visited and burning the edge.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { start, token: line[i], from: line[i - 1], visited: [...visited] },
        };
        step += 1;
    }
    const end = line[line.length - 1] as string;
    const stuck = (EDGES[end] ?? []).every((n) => visited.has(n));
    yield {
        stepNumber: step,
        entities: geoCells(end, visited),
        edges: [],
        description: stuck
            ? `Token stranded at dead-end ${end} with no unused outgoing edge, so the player to move loses this line.`
            : `Token rests at ${end} with fresh outgoing edges; the game continues.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { start, end, stuck, winning },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: geoCells(end, visited),
        edges: [],
        description: `Solved: start ${start} is ${winning ? "winning (N-position)" : "losing (P-position)"}, so ${winning ? "first" : "second"} player wins with perfect play.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { start, winning, winner: winning ? "first" : "second" },
    };
}

const module: AlgorithmModule = {
    id: "geography-game",
    name: "Geography Game",
    category: "game",
    complexity: { time: "O(2^n)", space: "O(n)" },
    defaultInput: { start: "A" },
    visualType: "grid",
    run,
    pseudocode: [
        "start with the token on vertex start and mark it visited",
        "a move travels one unused directed edge to a fresh vertex",
        "the player with no unused outgoing edge loses the game",
        "search replies by DFS: start A loses since B and C reach D",
        "play the demo line A to B to D and strand the mover",
        "winner is first player from N-positions, second from P-positions",
    ],
};

export default module;
