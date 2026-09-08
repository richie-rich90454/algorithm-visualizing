// staircase-nim.ts – Staircase Nim: move stones down one pile; off pile 1 vanish.
// Only piles at odd positions (1st, 3rd, …) matter: xor them like Nim.
// Default [2,1,3] xors to 1; winning move trims pile 3 from 3 to 2.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function pileCells(piles: number[], hot = -1): VisualEntity[] {
    const maxH = Math.max(...piles, 1);
    const cells: VisualEntity[] = [];
    for (let p = 0; p < piles.length; p += 1) {
        for (let r = 0; r < maxH; r += 1) {
            const full = r < (piles[p] ?? 0);
            cells.push({
                id: `cell-${p}-${r}`,
                type: "cell" as const,
                label: full ? "●" : "",
                value: full ? 1 : 0,
                state: (!full
                    ? "unvisited"
                    : p === hot
                      ? "comparing"
                      : p % 2 === 0
                        ? "sorted"
                        : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: maxH - 1 - r, col: p },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { piles?: number[] } | null) ?? {};
    const raw = Array.isArray(task.piles) ? task.piles : [2, 1, 3];
    const piles = raw
        .slice(0, 5)
        .map((v) => (typeof v === "number" && v > 0 ? Math.min(9, Math.floor(v)) : 0));
    while (piles.length < 3) piles.push(0);
    let step = 0;
    const x = piles.filter((_, i) => i % 2 === 0).reduce((a, b) => a ^ b, 0);
    yield {
        stepNumber: step,
        entities: pileCells(piles),
        edges: [],
        description: `Staircase Nim [${piles.join(", ")}] – xor of odd-position piles = ${x}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { piles, xor: x },
    };
    step += 1;
    if (x === 0) {
        yield {
            stepNumber: step,
            entities: pileCells(piles),
            edges: [],
            description: "Xor is 0 – a P-position, losing for the player to move.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { piles, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: pileCells(piles),
            edges: [],
            description: `Staircase Nim [${piles.join(", ")}] is losing for the player to move.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { piles, winning: false },
        };
        return;
    }
    let chosen = -1;
    let target = 0;
    for (let i = 0; i < piles.length; i += 2) {
        const t = (piles[i] ?? 0) ^ x;
        if (t < (piles[i] ?? 0)) {
            chosen = i;
            target = t;
            break;
        }
    }
    yield {
        stepNumber: step,
        entities: pileCells(piles, chosen),
        edges: [],
        description: `Winning move: shift ${(piles[chosen] ?? 0) - target} stone${(piles[chosen] ?? 0) - target > 1 ? "s" : ""} from pile ${chosen + 1} down (pile ${chosen + 1}: ${piles[chosen] ?? 0} -> ${target}).`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { piles, chosen, target },
    };
    step += 1;
    const after = [...piles];
    after[chosen] = target;
    if (chosen > 0) after[chosen - 1] = (after[chosen - 1] ?? 0) + ((piles[chosen] ?? 0) - target);
    const x2 = after.filter((_, i) => i % 2 === 0).reduce((a, b) => a ^ b, 0);
    yield {
        stepNumber: step,
        entities: pileCells(after),
        edges: [],
        description: `After the shift [${after.join(", ")}] – odd-position xor = ${x2}, a P-position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { piles: after, xor: x2 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: pileCells(after),
        edges: [],
        description: `First player wins Staircase Nim [${piles.join(", ")}] with this shift.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { piles: after, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "staircase-nim",
    name: "Staircase Nim",
    category: "game",
    complexity: { time: "O(p)", space: "O(1)" },
    defaultInput: { piles: [2, 1, 3] },
    visualType: "grid",
    run,
};

export default module;
