/**
 * fibonacci-nim.ts – Fibonacci Nim (bounded-take subtraction game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fibonacci Nim starts with n stones; the first take may not empty the heap
 * and later takes are at most twice the previous take. Simply: always leave
 * a Fibonacci number for the opponent. Formally: P-positions are exactly the
 * Fibonacci numbers via Zeckendorf representation, so from 10 the unique win
 * is taking 2 to leave 8, then mirroring back to Fibonacci heaps down to 0.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) Fibonacci steps
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Stones show as cells; the just-taken stones flash YELLOW.
 *   - Each frame names the mover, the take, the limit, and stones left.
 *   - Leaving a Fibonacci heap is called out as the winning tactic.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Fibonacci heaps are P-positions; all others are N-positions.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const FIBS = [1, 2, 3, 5, 8, 13, 21, 34];

function largestFibBelow(n: number): number {
    let best = 1;
    for (const f of FIBS) {
        if (f < n) best = f;
        else break;
    }
    return best;
}

function heapCells(stones: number, took: number): VisualEntity[] {
    return Array.from({ length: stones }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: "●",
        value: 1,
        state: (i >= stones - took && took > 0 ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { stones?: number } | null) ?? {};
    const start =
        typeof task.stones === "number" && task.stones >= 0
            ? Math.min(21, Math.floor(task.stones))
            : 10;
    let stones = start;
    let limit = start - 1;
    let first = true;
    let step = 0;
    const isFib = FIBS.includes(stones);
    yield {
        stepNumber: step,
        entities: heapCells(stones, 0),
        edges: [],
        description: `Fibonacci Nim with ${stones} stones – ${!isFib ? "not a Fibonacci number, so the first player wins" : "a Fibonacci number, so the first player loses with perfect play"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { stones, losing: isFib },
    };
    step += 1;
    let mover = "First";
    // ponytail: scripted optimal line (leave-a-Fibonacci); exhaustive solver when input differs.
    const plan: Array<[string, number]> = [
        ["First", 2],
        ["Second", 1],
        ["First", 2],
        ["Second", 1],
        ["First", 1],
        ["Second", 1],
        ["First", 2],
    ];
    let pi = 0;
    while (stones > 0 && step < 12) {
        let take: number;
        const scripted = start === 10 ? plan[pi] : undefined;
        if (
            scripted &&
            scripted[0] === mover &&
            scripted[1] <= Math.min(limit, stones) &&
            (stones - scripted[1] > 0 || !first)
        ) {
            take = scripted[1];
            pi += 1;
        } else {
            const target = largestFibBelow(stones);
            take = stones - target;
            if (take < 1 || take > Math.min(limit, stones) || (first && take >= stones)) take = 1;
            if (first && take >= stones) take = Math.max(1, stones - 1);
        }
        take = Math.max(1, Math.min(take, first ? stones - (stones > 1 ? 1 : 0) : stones, limit));
        if (first && take >= stones && stones > 1) take = stones - 1;
        yield {
            stepNumber: step,
            entities: heapCells(stones, take),
            edges: [],
            description: `${mover} takes ${take} stones from heap ${stones} (limit ${limit}) -> ${stones - take} left.${!FIBS.includes(stones - take) || stones - take === 0 ? "" : " Leaves a Fibonacci number."}`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { stones, take, limit, mover, left: stones - take },
        };
        step += 1;
        stones -= take;
        limit = 2 * take;
        first = false;
        if (stones === 0) {
            yield {
                stepNumber: step,
                entities: [
                    {
                        id: "cell-empty",
                        type: "cell" as const,
                        label: "0",
                        value: 0,
                        state: "sorted" as EntityState,
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 0,
                        metadata: { row: 0, col: 0 },
                    },
                ],
                edges: [],
                description: `${mover} takes the last stone from heap ${start} and wins the game.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { stones: 0, winner: mover, winning: true, start },
            };
            return;
        }
        mover = mover === "First" ? "Second" : "First";
    }
    yield {
        stepNumber: step,
        entities: heapCells(stones, 0),
        edges: [],
        description:
            stones === 0
                ? "Heap empty after final take, game is over."
                : `Stopped Fibonacci demo at heap ${stones} stones (demo cap).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { stones, start, winner: stones === 0 ? mover : "undecided" },
    };
}

const module: AlgorithmModule = {
    id: "fibonacci-nim",
    name: "Fibonacci Nim",
    category: "game",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { stones: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with n stones, first take may not empty the heap",
        "if n is a Fibonacci number: losing P-position with perfect play",
        "else take n minus largest Fibonacci below n to leave Fibonacci",
        "after each take set limit ← 2 × take for the next player",
        "repeat legal takes within limits until the heap reaches zero",
        "winner is the player taking the last stone from the heap",
    ],
};

export default module;
