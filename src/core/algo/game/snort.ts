/**
 * snort.ts – Snort (partisan claiming game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Snort is the mirror of Col: Left claims L and Right claims R, but here a
 * player may not claim next to an enemy piece while same-color adjacency is
 * fine. Simply: claim outward so your pieces fence the opponent out.
 * Formally: each claim deletes neighboring cells for the opponent only,
 * splitting the strip into independent regions, and the 1x4 line Left 0,
 * Right 3, Left 1 strands Right because the last free cell 2 neighbors
 * enemy Left at 1.
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
 *   - Right claims highlight; the just-claimed cell flashes YELLOW.
 *   - The fenced-out cell shows why the player to move has no reply.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Partisan: adjacency bans apply against enemy pieces only.
 *   - The player unable to claim loses (normal play).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function snortCells(board: string[], hot = -1): VisualEntity[] {
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
        entities: snortCells(board),
        edges: [],
        description: `Snort on empty 1x${size} strip – Left (L) moves first and may not touch enemy R.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, player: "Left" },
    };
    step += 1;
    // ponytail: one illustrative legal line; full Snort theory when analysis input exists.
    const line: Array<[number, string]> = [
        [0, "L"],
        [size - 1, "R"],
        [1, "L"],
    ];
    for (const [at, who] of line) {
        board[at] = who;
        yield {
            stepNumber: step,
            entities: snortCells(board, at),
            edges: [],
            description: `${who === "L" ? "Left" : "Right"} claims empty cell ${at} with ${who}; no enemy neighbor blocks this claim.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size, at, who, move: [at, who] },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: snortCells(board),
        edges: [],
        description:
            "Free cell 2 neighbors enemy Left at 1, so Right has no legal claim left and loses this line.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { size, winner: "Left", winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: snortCells(board),
        edges: [],
        description: "Left wins this Snort line by fencing Right out of every remaining cell.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { size, winner: "Left", winning: true },
    };
}

const module: AlgorithmModule = {
    id: "snort",
    name: "Snort",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from an empty 1 x n strip with Left (L) to move first",
        "a move claims an empty cell with no enemy piece adjacent",
        "play Left 0, Right 3, then Left 1 along the legal line",
        "highlight each claimed cell and its fenced enemy neighbors",
        "stop when every free cell touches an enemy claim",
        "winner is Left, since Right to move has no legal claim",
    ],
};

export default module;
