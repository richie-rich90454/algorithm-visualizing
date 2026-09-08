// dawsons-kayles.ts – Dawson's Kayles: fell 2 adjacent pins, neighbours go too.
// A move at i leaves segments of length max(0,i-1) and max(0,n-i-3).
// Grundy computed in-code; default row of 7 has G=0 (P-position).
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
        description: `Dawson's Kayles row of ${n} pins – Grundy G(${n}) = ${g}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { pins: n, grundy: g },
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
            description: `Try felling ${demo} and ${demo + 1}: remainder xors to ${replies[demo]} (an N-position for the opponent).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { pins: n, tried: [demo, demo + 1], xor: replies[demo] },
        };
        step += 1;
    }
    const winning = replies.some((v) => v === 0);
    yield {
        stepNumber: step,
        entities: rowCells(n),
        edges: [],
        description: winning
            ? "A reply leaves xor 0 – an N-position, so the player to move wins."
            : `All ${replies.length} legal fellings leave non-zero xor – a P-position, losing with perfect play.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { pins: n, grundy: g, winning },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: rowCells(n),
        edges: [],
        description: winning
            ? `Dawson's Kayles(${n}) is winning for the player to move (G = ${g}).`
            : `Dawson's Kayles(${n}) is losing for the player to move (G = 0).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { pins: n, winning },
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
};

export default module;
