// node-kayles.ts – Node Kayles: pick a vertex; it and its neighbors vanish.
// Solved by bitmask recursion on the tiny default path graph; the winning
// pick is verified in-code. Default P5: take the center, leaving two singles.
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
        description: `Node Kayles on path P${count} – the player to move ${winning ? "wins" : "loses"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { vertices: count, winning },
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
            description: "Every pick leaves the opponent a winning reply – a P-position.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { vertices: count, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: nodeCells(count, alive),
            edges: [],
            description: `Node Kayles on P${count} is losing for the player to move.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { vertices: count, winning: false },
        };
        return;
    }
    const removed = new Set([pick, ...(adj[pick] ?? [])]);
    yield {
        stepNumber: step,
        entities: nodeCells(count, alive, pick),
        edges: [],
        description: `Winning pick: vertex v${pick} (removes ${[...removed]
            .sort((a, b) => a - b)
            .map((v) => `v${v}`)
            .join(", ")}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { vertices: count, pick },
    };
    step += 1;
    const rest = new Set([...alive].filter((v) => !removed.has(v)));
    yield {
        stepNumber: step,
        entities: nodeCells(count, rest),
        edges: [],
        description: `Remaining components are losing for the player to move – a P-position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { vertices: count, remaining: [...rest] },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: nodeCells(count, rest),
        edges: [],
        description: `First player wins Node Kayles on P${count} by taking v${pick}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { vertices: count, winning: true },
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
};

export default module;
