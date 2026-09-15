/**
 * treblecross.ts – Treblecross (first three-in-a-row wins)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Treblecross marks X on a 1-D strip; the first player to complete three
 * consecutive X wins immediately. Simply: scan every empty square for an
 * instant XXX and take it. Formally: the demo checks each empty cell with
 * an exact three-window test, and the default X at 2 and 3 threatens wins
 * at squares 1 and 4, so the winning reply is computed, never hardcoded.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) scan over the strip
 *   Space: O(n) mark set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Placed X marks highlight; empty squares stay idle.
 *   - Threat squares that complete XXX flash YELLOW (comparing).
 *   - The completed winning triple paints GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Misere-like inversion: making three loses in Dawson's Kayles but wins here.
 *   - First to hold three consecutive marks wins at once.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function completesThree(marks: Set<number>, at: number, size: number): boolean {
    if (marks.has(at)) return false;
    const with_ = new Set(marks);
    with_.add(at);
    for (let s = Math.max(0, at - 2); s + 2 < size && s <= at; s += 1) {
        if (with_.has(s) && with_.has(s + 1) && with_.has(s + 2)) return true;
    }
    return false;
}

function boardCells(
    size: number,
    marks: Set<number>,
    hot: Set<number> = new Set(),
    won: Set<number> = new Set(),
): VisualEntity[] {
    return Array.from({ length: size }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: marks.has(i) ? "X" : "",
        value: marks.has(i) ? 1 : 0,
        state: (won.has(i)
            ? "sorted"
            : hot.has(i)
              ? "comparing"
              : marks.has(i)
                ? "highlight"
                : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number; marks?: number[] } | null) ?? {};
    const size =
        typeof task.size === "number" && task.size > 0 ? Math.min(11, Math.floor(task.size)) : 7;
    const raw = Array.isArray(task.marks) ? task.marks : [2, 3];
    const marks = new Set<number>();
    for (const m of raw) {
        if (Number.isInteger(m) && m >= 0 && m < size) marks.add(m);
    }
    let step = 0;
    yield {
        stepNumber: step,
        entities: boardCells(size, marks),
        edges: [],
        description: `Treblecross opens on 1x${size} strip with X marks at [${[...marks].sort((a, b) => a - b).join(", ")}] – first to make XXX wins.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, marks: [...marks] },
    };
    step += 1;
    const threats: number[] = [];
    for (let i = 0; i < size; i += 1) {
        if (!marks.has(i) && completesThree(marks, i, size)) threats.push(i);
    }
    yield {
        stepNumber: step,
        entities: boardCells(size, marks, new Set(threats)),
        edges: [],
        description:
            threats.length > 0
                ? `Immediate winning squares on strip ${size}: cells ${threats.join(", ")} each complete three consecutive X.`
                : `No immediate win on strip ${size} – no empty square completes three in a row.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { size, marks: [...marks], threats },
    };
    step += 1;
    if (threats.length === 0) {
        yield {
            stepNumber: step,
            entities: boardCells(size, marks),
            edges: [],
            description:
                "Position is quiet with no forced triple; the game continues without a winning reply this move.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { size, marks: [...marks], winning: false, winner: "undecided" },
        };
        return;
    }
    const play = threats[0] as number;
    const after = new Set(marks);
    after.add(play);
    yield {
        stepNumber: step,
        entities: boardCells(size, after, new Set([play])),
        edges: [],
        description: `Winning reply: play X at empty square ${play} to threaten the triple.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { size, play, winning: true },
    };
    step += 1;
    const line = new Set<number>();
    for (let s = Math.max(0, play - 2); s + 2 < size && s <= play; s += 1) {
        if (after.has(s) && after.has(s + 1) && after.has(s + 2)) {
            line.add(s);
            line.add(s + 1);
            line.add(s + 2);
        }
    }
    yield {
        stepNumber: step,
        entities: boardCells(size, after, new Set(), line),
        edges: [],
        description: `Triple XXX complete at squares [${[...line].sort((a, b) => a - b).join(", ")}] – the player playing ${play} wins.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { size, play, winning: true, winner: "mover" },
    };
}

const module: AlgorithmModule = {
    id: "treblecross",
    name: "Treblecross",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { size: 7, marks: [2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "start from a 1 x n strip with existing X marks placed",
        "scan each empty square for completing three consecutive X",
        "if no square completes XXX: quiet position, game continues",
        "highlight every immediate winning square on the strip",
        "play X on the first winning square to complete the triple",
        "winner is the mover completing three in a row with that X",
    ],
};

export default module;
