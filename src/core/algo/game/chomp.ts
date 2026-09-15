/**
 * chomp.ts – Chomp
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chomp is played on a rectangular chocolate bar. A move picks a cookie and
 * eats it plus everything below and to the right. The top-left cookie is
 * poisoned, so the player forced to eat it loses (misere ending). Simply:
 * always hand the opponent a P-position. Formally: the first player wins
 * every board except 1x1 via a strategy-stealing argument, and tiny boards
 * are solved here by exhaustive recursion to find the exact winning chomp.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(3^(r·c)) exhaustive search on tiny boards
 *   Space: O(3^(r·c)) memo states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each cookie is a cell; the poisoned cookie is marked P and painted RED.
 *   - The winning chomp square flashes YELLOW (comparing).
 *   - The remaining board is shown as a P-position for the opponent.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - First player wins all boards except 1x1.
 *   - Taking the poison cookie loses immediately.
 */
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
            description:
                "Only the poisoned cookie remains – the player to move must eat it and loses.",
            codeLineNumber: 4,
            layout: "grid",
            meta: { rows, cols, winning: false, winner: "second" },
        };
        return;
    }
    const [mr, mc] = move;
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols, `${mr},${mc}`),
        edges: [],
        description: `Winning chomp at row ${mr} column ${mc} – removes it and everything below-right.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows, cols, move, winning: true },
    };
    step += 1;
    heights = heights.map((v, i) => (i < mr ? v : Math.min(v, mc)));
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols),
        edges: [],
        description: `Board after the chomp at (${mr}, ${mc}) – a P-position, so every reply has a winning response.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows, cols, heights: norm(heights), winning: true, move },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: boardCells(heights, cols),
        edges: [],
        description: `First player wins ${rows}x${cols} Chomp by chomping (${mr}, ${mc}) first.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows, cols, winning: true, winner: "first", move },
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
    pseudocode: [
        "start from an r x c chocolate bar with poison at top-left (0, 0)",
        "solve tiny boards by recursion: a move wins if a reply loses",
        "if only poison remains: losing P-position, player to move loses",
        "else find a chomp square whose remainder is a P-position",
        "highlight the winning chomp square and its below-right region",
        "show the remaining board as a P-position for the opponent",
        "winner is the first player except on 1x1 where second wins",
    ],
};

export default module;
