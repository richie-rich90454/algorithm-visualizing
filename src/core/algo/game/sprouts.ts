/**
 * sprouts.ts – Sprouts (topological pencil game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sprouts starts with spots having 3 lives each. A move joins two live
 * spots (or loops one spot) with a curve and adds a new spot on it. Simply:
 * each move spends 2 lives at the endpoints and refunds 1 on the newcomer,
 * so lives drain fast. Formally: the game must end within 3n-1 moves, and
 * the illustrated 2-spot opening loops S1, drops it to 1 life, and births a
 * 1-life newcomer for continued play.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(moves) over the drawn curves
 *   Space: O(spots) live-spot table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Live spots paint GREEN (sorted); dead spots paint RED (swapped).
 *   - The spot being joined flashes YELLOW (comparing).
 *   - Labels show remaining lives per spot plus the newcomer count.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Every game ends after at most 3n-1 moves from n spots.
 *   - The player making the last legal curve wins.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function sproutCells(spots: Array<{ name: string; lives: number }>, hot = ""): VisualEntity[] {
    return spots.map((s, i) => ({
        id: `cell-${s.name}`,
        type: "cell" as const,
        label: `${s.name}(${s.lives})`,
        value: s.lives,
        state: (s.name === hot ? "comparing" : s.lives > 0 ? "sorted" : "swapped") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, lives: s.lives },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { spots?: number } | null) ?? {};
    const start =
        typeof task.spots === "number" && task.spots >= 1 ? Math.min(3, Math.floor(task.spots)) : 2;
    const spots = Array.from({ length: start }, (_, i) => ({ name: `S${i + 1}`, lives: 3 }));
    let step = 0;
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description: `Sprouts opens with ${start} live spot${start === 1 ? "" : "s"} – every spot starts with 3 lives for First to move.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { spots: start, lives: spots.map((s) => s.lives), player: "First" },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: sproutCells(spots, "S1"),
        edges: [],
        description:
            "First draws a legal loop curve from live spot S1 back to S1 (spends 2 of its 3 lives).",
        codeLineNumber: 1,
        layout: "grid",
        meta: { spots: start, move: "loop S1", lives: spots.map((s) => s.lives) },
    };
    step += 1;
    const first = spots[0];
    if (first) first.lives -= 2;
    const newcomer = { name: `S${spots.length + 1}`, lives: 1 };
    spots.push(newcomer);
    yield {
        stepNumber: step,
        entities: sproutCells(spots, newcomer.name),
        edges: [],
        description: `New spot ${newcomer.name} is born on the loop with 1 life; parent spot S1 drops to ${first?.lives} lives.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { spots: spots.length, lives: spots.map((s) => s.lives), move: "loop S1" },
    };
    step += 1;
    const total = spots.reduce((a, s) => a + s.lives, 0);
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description: `${total} total lives remain across ${spots.length} live spots – at most ${Math.floor(total / 2)} further curves can exist.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { lives: total, spots: spots.length },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: sproutCells(spots),
        edges: [],
        description:
            "Legal Sprouts opening curve complete; play continues until no live spot pair admits a curve, and the last mover wins.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { spots: spots.length, lives: total, winner: "undecided" },
    };
}

const module: AlgorithmModule = {
    id: "sprouts",
    name: "Sprouts",
    category: "game",
    complexity: { time: "O(moves)", space: "O(spots)" },
    defaultInput: { spots: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "start from 2 spots with 3 lives each and First to move",
        "a move joins two live spots or loops one, then adds a spot",
        "each curve spends 2 endpoint lives and refunds 1 on the newcomer",
        "play the opening loop on S1 and birth the 1-life newcomer",
        "count remaining lives to bound the curves still possible",
        "winner is the player drawing the last legal curve on the map",
    ],
};

export default module;
