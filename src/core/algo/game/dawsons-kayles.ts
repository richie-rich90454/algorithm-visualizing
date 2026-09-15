/**
 * dawsons-kayles.ts – Dawson's Kayles (knockdown with neighbor loss)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dawson's Kayles fells 2 adjacent pins plus their immediate neighbors, so a
 * move at i leaves segments of length max(0,i-1) and max(0,n-i-3). Simply:
 * pick the pair whose leftover segments xor to 0. Formally: Grundy numbers
 * are computed in code with that split rule, and the default row of 7 has
 * G = 0, a P-position losing for the player to move.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) Grundy computation
 *   Space: O(n) memo table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Standing pins paint GREEN; felled and neighbor pins go idle.
 *   - Each tried adjacent pair flashes YELLOW with its remainder xor.
 *   - The verdict names the N-position or P-position status.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - G(n) = 0 marks a P-position; otherwise an N-position.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function dawson(n: number, memo: Map<number, number>): number {
    const hit = memo.get(n);
    if (hit !== undefined) return hit;
    const seen = new Set<number>();
    for (let i = 0; i + 1 < n; i += 1) {
        seen.add(dawson(Math.max(0, i - 1), memo) ^ dawson(Math.max(0, n - i - 3), memo));
    }
    let g = 0;
    while (seen.has(g)) g += 1;
    memo.set(n, g);
    return g;
}

function rowCells(
    n: number,
    gone: Set<number> = new Set(),
    hot: Set<number> = new Set(),
): VisualEntity[] {
    return Array.from({ length: n }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: gone.has(i) ? "" : "●",
        value: gone.has(i) ? 0 : 1,
        state: (gone.has(i) ? "unvisited" : hot.has(i) ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pins?: number } | null) ?? {};
    const n =
        typeof task.pins === "number" && task.pins >= 0 ? Math.min(12, Math.floor(task.pins)) : 7;
    const memo = new Map<number, number>();
    const g = dawson(n, memo);
    let step = 0;
    yield {
        stepNumber: step,
        entities: rowCells(n),
        edges: [],
        description: `Dawson's Kayles row of ${n} pins with Grundy G(${n}) = ${g} – ${g !== 0 ? "winning N-position" : "losing P-position"} for the player to move.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { pins: n, grundy: g, winning: g !== 0, winner: g !== 0 ? "first" : "second" },
    };
    step += 1;
    const replies: number[] = [];
    for (let i = 0; i + 1 < n; i += 1) {
        replies.push(dawson(Math.max(0, i - 1), memo) ^ dawson(Math.max(0, n - i - 3), memo));
    }
    for (const demo of [0, Math.max(0, Math.floor(n / 2) - 1)]) {
        if (demo + 1 >= n) continue;
        const gone = new Set<number>(
            [demo - 1, demo, demo + 1, demo + 2].filter((v) => v >= 0 && v < n),
        );
        yield {
            stepNumber: step,
            entities: rowCells(n, gone, new Set([demo, demo + 1])),
            edges: [],
            description: `Try Dawson felling pins ${demo} and ${demo + 1} on row ${n}: remainder segments xor to ${replies[demo]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { pins: n, grundy: g, tried: [demo, demo + 1], xor: replies[demo] },
        };
        step += 1;
    }
    const winning = replies.some((v) => v === 0);
    yield {
        stepNumber: step,
        entities: rowCells(n),
        edges: [],
        description: winning
            ? `Dawson row ${n} has a felling leaving xor 0 – an N-position, so the player to move wins.`
            : `All ${replies.length} legal fellings on row ${n} leave nonzero xor – a P-position, losing with perfect play.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { pins: n, grundy: g, winning },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: rowCells(n),
        edges: [],
        description: winning
            ? `Dawson's Kayles(${n}) with Grundy G = ${g} is winning for the player to move.`
            : `Dawson's Kayles(${n}) with Grundy G = 0 is losing for the player to move.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { pins: n, grundy: g, winning, winner: winning ? "first" : "second" },
    };
}

const module: AlgorithmModule = {
    id: "dawsons-kayles",
    name: "Dawson's Kayles",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { pins: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from a row of n pins with Dawson Grundy G(n)",
        "for each adjacent pair show split segments and their xor",
        "if some felling leaves xor 0: winning N-position to play",
        "else every felling leaves nonzero xor: losing P-position",
        "play the zero-xor felling when it exists for the demo",
        "winner is first player unless G(n) = 0 where second wins",
    ],
};

export default module;
