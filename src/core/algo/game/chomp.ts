// chomp.ts – Chomp: chomp a cookie plus everything below-right of it.
// Top-left is poison; taking it loses. Tiny boards are solved by exhaustive
// recursion in-code, so the shown winning move is exact, not memorised.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function norm(h: number[]): number[] {
    const t = [...h];
    while (t.length > 0 && t[t.length - 1] === 0) t.pop();
    return t;
}

function chompWin(h: number[], memo: Map<string, boolean>): boolean {
    const k = norm(h).join(",");
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    for (let r = 0; r < h.length; r += 1) {
        for (let c = 0; c < (h[r] ?? 0); c += 1) {
            if (r === 0 && c === 0) continue;
            const nh = h.map((v, i) => (i < r ? v : Math.min(v, c)));
            if (!chompWin(nh, memo)) {
                memo.set(k, true);
                return true;
            }
        }
    }
    memo.set(k, false);
    return false;
}

function boardCells(h: number[], cols: number, hot: string | null = null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < h.length; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const present = c < (h[r] ?? 0);
            const id = `${r},${c}`;
            cells.push({
                id: `cell-${id}`,
                type: "cell" as const,
                label: !present ? "" : r === 0 && c === 0 ? "P" : "●",
                value: present ? 1 : 0,
                state: (!present
                    ? "unvisited"
                    : r === 0 && c === 0
                      ? "swapped"
                      : id === hot
                        ? "comparing"
                        : "sorted") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rows?: number; cols?: number } | null) ?? {};
    const rows =
        typeof task.rows === "number" && task.rows > 0 ? Math.min(4, Math.floor(task.rows)) : 3;
    const cols =
        typeof task.cols === "number" && task.cols > 0 ? Math.min(4, Math.floor(task.cols)) : 3;
    let heights = new Array<number>(rows).fill(cols);
    const memo = new Map<string, boolean>();
    const winning = chompWin(heights, memo);
    let step = 0;
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols),
        edges: [],
        description: `Chomp ${rows}×${cols} – P marks the poisoned cookie; the player to move ${winning ? "wins" : "loses"} with perfect play.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, winning },
    };
    step += 1;
    let move: [number, number] | null = null;
    for (let r = 0; r < rows && !move; r += 1) {
        for (let c = 0; c < (heights[r] ?? 0) && !move; c += 1) {
            if (r === 0 && c === 0) continue;
            const nh = heights.map((v, i) => (i < r ? v : Math.min(v, c)));
            if (!chompWin(nh, memo)) move = [r, c];
        }
    }
    if (!move) {
        yield {
            stepNumber: step,
            entities: boardCells(heights, cols),
            edges: [],
            description: "Only poison remains – the player to move loses.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows, cols, winning: false },
        };
        return;
    }
    const [mr, mc] = move;
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols, `${mr},${mc}`),
        edges: [],
        description: `Winning chomp at (${mr}, ${mc}) – removes it and everything below-right.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows, cols, move },
    };
    step += 1;
    heights = heights.map((v, i) => (i < mr ? v : Math.min(v, mc)));
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols),
        edges: [],
        description: `Board after the chomp – a P-position, so every reply has a winning response.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows, cols, heights: norm(heights) },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols),
        edges: [],
        description: `First player wins ${rows}×${cols} Chomp by chomping (${mr}, ${mc}) first.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows, cols, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "chomp",
    name: "Chomp",
    category: "game",
    complexity: { time: "O(3^(r·c))", space: "O(3^(r·c))" },
    defaultInput: { rows: 3, cols: 3 },
    visualType: "grid",
    run,
};

export default module;
