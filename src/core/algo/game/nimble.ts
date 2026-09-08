// nimble.ts – Nimble: coins on a strip; a move slides one coin left any amount.
// Position value = xor of coin squares (0-indexed). Default coins at 1,4,6
// xor to 3; winning move slides the coin from 6 back to 5 (computed).
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function stripCells(coins: Set<number>, size: number, hot = -1): VisualEntity[] {
    return Array.from({ length: size }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: coins.has(i) ? "●" : String(i),
        value: coins.has(i) ? 1 : 0,
        state: (i === hot ? "comparing" : coins.has(i) ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { coins?: number[] } | null) ?? {};
    const raw = Array.isArray(task.coins) ? task.coins : [1, 4, 6];
    const coins = new Set<number>();
    for (const c of raw) {
        if (Number.isInteger(c) && c >= 0 && c <= 9) coins.add(c);
    }
    if (coins.size === 0) coins.add(3);
    const size = Math.max(...coins) + 2;
    let step = 0;
    const x = [...coins].reduce((a, b) => a ^ b, 0);
    yield {
        stepNumber: step,
        entities: stripCells(coins, size),
        edges: [],
        description: `Nimble coins at [${[...coins].sort((a, b) => a - b).join(", ")}] – xor = ${x}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { coins: [...coins], xor: x },
    };
    step += 1;
    if (x === 0) {
        yield {
            stepNumber: step,
            entities: stripCells(coins, size),
            edges: [],
            description: "Xor is 0 – a P-position, losing for the player to move.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { xor: x, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: stripCells(coins, size),
            edges: [],
            description: "Nimble is losing for the player to move from this P-position.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { xor: x, winning: false },
        };
        return;
    }
    let from = -1;
    let to = -1;
    for (const c of coins) {
        const t = c ^ x;
        if (t < c && !coins.has(t)) {
            from = c;
            to = t;
            break;
        }
    }
    // ponytail: occupied landing squares need a two-coin shuffle; tiny demo keeps simple cases.
    if (from < 0) {
        yield {
            stepNumber: step,
            entities: stripCells(coins, size),
            edges: [],
            description: `Xor is ${x} but the direct slide is blocked – the win needs a longer combination.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { xor: x },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: stripCells(coins, size, from),
        edges: [],
        description: `Winning move: slide the coin from ${from} back to ${to} (${from} ^ ${x} = ${to}), zeroing the xor.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { xor: x, from, to },
    };
    step += 1;
    const after = new Set(coins);
    after.delete(from);
    after.add(to);
    yield {
        stepNumber: step,
        entities: stripCells(after, size, to),
        edges: [],
        description: `Coins at [${[...after].sort((a, b) => a - b).join(", ")}] – xor = ${[...after].reduce((a, b) => a ^ b, 0)}, a P-position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { coins: [...after], xor: 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stripCells(after, size),
        edges: [],
        description: "First player wins Nimble with this slide.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { winning: true },
    };
}

const module: AlgorithmModule = {
    id: "nimble",
    name: "Nimble",
    category: "game",
    complexity: { time: "O(c)", space: "O(c)" },
    defaultInput: { coins: [1, 4, 6] },
    visualType: "grid",
    run,
};

export default module;
