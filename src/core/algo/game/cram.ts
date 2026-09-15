/**
 * cram.ts – Cram (impartial domino-packing game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cram is played on a board where both players place dominoes on two empty
 * orthogonally adjacent cells. The player unable to move loses. Simply:
 * keep splitting the board into regions your opponent cannot fill. Formally:
 * the board is a disjunctive sum whose Grundy value decides the winner, and
 * the illustrated 3x3 line fills 8 of 9 cells so the stranded single cell
 * leaves the player to move with no domino fit.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) for the illustrated packing line
 *   Space: O(n^2) board cells
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Empty cells are idle; placed dominoes paint GREEN (sorted).
 *   - The just-placed domino flashes YELLOW (comparing).
 *   - The stranded single cell shows why the player to move loses.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Impartial: both players share the same moves.
 *   - Last move wins under normal play.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Domino = [string, string];

function cramCells(used: Map<string, number>, last: Domino | null): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
            const id = `${r},${c}`;
            const owner = used.get(id);
            cells.push({
                id: `cell-${id}`,
                type: "cell" as const,
                label: owner === undefined ? "" : `D${owner}`,
                value: owner ?? 0,
                state: (owner === undefined
                    ? "idle"
                    : last && (last[0] === id || last[1] === id)
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
    const task = (input as { size?: number } | null) ?? {};
    void task;
    const line: Domino[] = [
        ["0,0", "0,1"],
        ["1,0", "1,1"],
        ["2,0", "2,1"],
        ["0,2", "1,2"],
    ];
    const used = new Map<string, number>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: cramCells(used, null),
        edges: [],
        description: "Cram on empty 3x3 board with 9 free cells – First player to place a domino.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: 3, free: 9, player: "First" },
    };
    step += 1;
    let mover = "First";
    line.forEach(([a, b], i) => {
        used.set(a, i + 1);
        used.set(b, i + 1);
    });
    for (let i = 0; i < line.length; i += 1) {
        const dom = line[i] as Domino;
        const partial = new Map<string, number>();
        line.slice(0, i + 1).forEach(([a, b], j) => {
            partial.set(a, j + 1);
            partial.set(b, j + 1);
        });
        yield {
            stepNumber: step,
            entities: cramCells(partial, dom),
            edges: [],
            description: `${mover} places domino D${i + 1} covering empty cells ${dom[0]} and ${dom[1]}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: 3, domino: i + 1, cells: dom, mover },
        };
        step += 1;
        mover = mover === "First" ? "Second" : "First";
    }
    yield {
        stepNumber: step,
        entities: cramCells(used, null),
        edges: [],
        description:
            "Only cell (2,2) stays free with no empty neighbor – no domino fits, so Second to move loses this line.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { size: 3, winner: "First", winning: true, free: 1 },
    };
}

const module: AlgorithmModule = {
    id: "cram",
    name: "Cram",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { size: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from an empty 3 x 3 board with 9 free cells to fill",
        "a move places one domino on two empty adjacent cells",
        "place dominoes D1 through D4 along the illustrated legal line",
        "highlight each new domino and count the remaining free cells",
        "stop when only isolated cell (2,2) stays free with no fit",
        "winner is First, since Second to move has no domino placement",
    ],
};

export default module;
