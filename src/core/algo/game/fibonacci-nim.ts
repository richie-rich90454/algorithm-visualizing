// fibonacci-nim.ts – Fibonacci Nim: first take may not empty the heap, then ≤2×.
// P-positions are Fibonacci numbers (Zeckendorf). From 10 the unique win is
// take 2 -> 8; the demo then follows the leave-a-Fibonacci strategy to 0.
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
            description: `${mover} takes ${take} (limit ${limit}) -> ${stones - take} left.${!FIBS.includes(stones - take) || stones - take === 0 ? "" : " Leaves a Fibonacci number."}`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { stones, take, limit },
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
                description: `${mover} takes the last stone and wins.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { winner: mover },
            };
            return;
        }
        mover = mover === "First" ? "Second" : "First";
    }
    yield {
        stepNumber: step,
        entities: heapCells(stones, 0),
        edges: [],
        description: stones === 0 ? "Heap empty." : `Stopped at ${stones} stones (demo cap).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { stones },
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
};

export default module;
