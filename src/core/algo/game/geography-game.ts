// geography-game.ts – Geography: move a token along unused directed edges.
// Stuck player loses. DFS in-code shows start A is losing (both replies B,C
// reach the dead end D), while the demo line A->B->D strands the mover.
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
        description: `Geography on A->{B,C}, B->D, C->D with token at ${start} – player to move ${winning ? "wins" : "loses"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { start, winning },
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
            description: `Token moves ${line[i - 1]} -> ${line[i]} (edge used up).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { start, token: line[i] },
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
            ? `Token stranded at ${end} – no unused outgoing edge, so the player to move loses this line.`
            : `Token at ${end}; the game continues.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { start, end, stuck },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: geoCells(end, visited),
        edges: [],
        description: `Solved: ${start} is ${winning ? "winning (N-position)" : "losing (P-position)"} with perfect play.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { start, winning },
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
};

export default module;
