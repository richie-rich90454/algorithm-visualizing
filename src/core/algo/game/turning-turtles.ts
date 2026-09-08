// turning-turtles.ts – Turning Turtles: flip a head, optionally one coin left.
// Position value = xor of head squares (1-indexed). Default H T H T has
// heads {1,3}, xor 2; flipping 3 and toggling 1 clears the board (P).
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function turtleCells(coins: boolean[], hot: Set<number> = new Set()): VisualEntity[] {
    return coins.map((h, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: h ? "H" : "T",
        value: h ? 1 : 0,
        state: (hot.has(i) ? "comparing" : h ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function headXor(coins: boolean[]): number {
    return coins.reduce((a, h, i) => (h ? a ^ (i + 1) : a), 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coins?: boolean[] } | null) ?? {};
    const raw = Array.isArray(task.coins) ? task.coins : [true, false, true, false];
    const coins = raw.slice(0, 6).map((v) => v === true);
    while (coins.length < 2) coins.push(false);
    let step = 0;
    const x = headXor(coins);
    yield {
        stepNumber: step,
        entities: turtleCells(coins),
        edges: [],
        description: `Turning Turtles [${coins.map((h) => (h ? "H" : "T")).join(" ")}] – head-xor = ${x}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { coins: coins.map((h) => (h ? 1 : 0)), xor: x },
    };
    step += 1;
    if (x === 0) {
        yield {
            stepNumber: step,
            entities: turtleCells(coins),
            edges: [],
            description: "Head-xor is 0 – a P-position, losing for the player to move.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { xor: x, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: turtleCells(coins),
            edges: [],
            description:
                "No move preserves the zero xor; the player to move loses with perfect play.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { xor: x, winning: false },
        };
        return;
    }
    let flip = -1;
    let toggle = -1;
    search: for (let p = 0; p < coins.length; p += 1) {
        if (!coins[p]) continue;
        for (let q = -1; q < p; q += 1) {
            const next = [...coins];
            next[p] = false;
            if (q >= 0) next[q] = !next[q];
            if (headXor(next) === 0) {
                flip = p;
                toggle = q;
                break search;
            }
        }
    }
    yield {
        stepNumber: step,
        entities: turtleCells(coins, new Set([flip, toggle].filter((v) => v >= 0))),
        edges: [],
        description:
            toggle >= 0
                ? `Winning move: flip head ${flip + 1} to T and toggle coin ${toggle + 1}, zeroing the xor.`
                : `Winning move: flip head ${flip + 1} to T, zeroing the xor.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { xor: x, flip, toggle },
    };
    step += 1;
    const after = [...coins];
    after[flip] = false;
    if (toggle >= 0) after[toggle] = !after[toggle];
    yield {
        stepNumber: step,
        entities: turtleCells(after),
        edges: [],
        description: `[${after.map((h) => (h ? "H" : "T")).join(" ")}] – head-xor = ${headXor(after)}, a P-position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { coins: after.map((h) => (h ? 1 : 0)), xor: 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: turtleCells(after),
        edges: [],
        description: "First player wins Turning Turtles with this flip.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { winning: true },
    };
}

const module: AlgorithmModule = {
    id: "turning-turtles",
    name: "Turning Turtles",
    category: "game",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { coins: [true, false, true, false] },
    visualType: "grid",
    run,
};

export default module;
