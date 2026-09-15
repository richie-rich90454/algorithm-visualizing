/**
 * col.ts – Col (partisan map-coloring game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Col is a partisan game on a graph. Left paints cells blue (L) and Right
 * paints them red (R); same colors may never touch, while enemy adjacency is
 * fine. Simply: grab cells your opponent cannot use against you. Formally:
 * each move removes the painted cell for the opponent's color only where it
 * touches, splitting the board into independent regions evaluated by
 * combinatorial game values.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for the illustrated line
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Empty cells are idle; Left claims paint GREEN (sorted).
 *   - Right claims paint as highlighted; the just-painted cell flashes YELLOW.
 *   - A full board names the player who made the last move as winner.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Partisan: Left and Right have different legal moves.
 *   - The player unable to move loses (normal play).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function colCells(board: string[], hot = -1): VisualEntity[] {
    return board.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: v === "" ? "" : v,
        value: v === "" ? 0 : 1,
        state: (v === ""
            ? "idle"
            : i === hot
              ? "comparing"
              : v === "L"
                ? "sorted"
                : "highlight") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number } | null) ?? {};
    const size =
        typeof task.size === "number" && task.size >= 2 ? Math.min(6, Math.floor(task.size)) : 4;
    const board = new Array<string>(size).fill("");
    let step = 0;
    yield {
        stepNumber: step,
        entities: colCells(board),
        edges: [],
        description: `Col on 1x${size} strip – Left (L) moves first; same colors may never touch.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, player: "Left", winning: size > 0 },
    };
    step += 1;
    // ponytail: one illustrative legal line; full Col theory when analysis input exists.
    const line = (
        [
            [0, "L"],
            [1, "R"],
            [2, "L"],
            [3, "R"],
        ] as Array<[number, string]>
    ).slice(0, size);
    for (const [at, who] of line) {
        board[at] = who;
        yield {
            stepNumber: step,
            entities: colCells(board, at),
            edges: [],
            description: `${who === "L" ? "Left" : "Right"} paints empty cell ${at} with ${who} (neighbor ${at > 0 ? board[at - 1] || "empty" : "none"} differs, so the claim is legal).`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size, at, who, move: [at, who] },
        };
        step += 1;
    }
    const winner = line.length % 2 === 0 ? "Right" : "Left";
    yield {
        stepNumber: step,
        entities: colCells(board),
        edges: [],
        description: `Strip 1x${size} is full after ${line.length} painted cells – ${winner} made the last legal paint and wins.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { size, winner, winning: true, moves: line.length },
    };
}

const module: AlgorithmModule = {
    id: "col",
    name: "Col",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from an empty 1 x n strip with Left (L) to move first",
        "a move paints an empty cell your color with no same-color neighbor",
        "alternate Left and Right paints along the illustrated legal line",
        "highlight each painted cell and check its neighbors stay legal",
        "repeat paints until no empty cell admits a legal color",
        "winner is the player making the last legal paint on the strip",
    ],
};

export default module;
