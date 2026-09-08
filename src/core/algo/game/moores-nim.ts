// moores-nim.ts – Moore's Nim_k: remove stones from at most k piles per move.
// P-position iff every binary digit sums to 0 mod (k+1). Solved by brute
// force on the tiny default; the shown move is verified, not memorised.
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function bitSums(piles: number[], mod: number): number[] {
    const sums = [0, 0, 0, 0];
    for (const p of piles) {
        for (let b = 0; b < 4; b += 1) {
            if ((p >> b) & 1) sums[b] = ((sums[b] ?? 0) + 1) % mod;
        }
    }
    return sums;
}

function pileCells(piles: number[], hot: Set<number> = new Set()): VisualEntity[] {
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
                state: (!full ? "unvisited" : hot.has(p) ? "comparing" : "sorted") as EntityState,
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
    const task = (input as { piles?: number[]; k?: number } | null) ?? {};
    const raw = Array.isArray(task.piles) ? task.piles : [3, 4, 5];
    const piles = raw
        .slice(0, 3)
        .map((v) => (typeof v === "number" && v > 0 ? Math.min(7, Math.floor(v)) : 0));
    while (piles.length < 3) piles.push(0);
    const k = typeof task.k === "number" && task.k >= 1 ? Math.min(2, Math.floor(task.k)) : 2;
    const mod = k + 1;
    let step = 0;
    const sums = bitSums(piles, mod);
    const losing = sums.every((s) => s === 0);
    yield {
        stepNumber: step,
        entities: pileCells(piles),
        edges: [],
        description: `Moore's Nim_${k} [${piles.join(", ")}] – binary digit sums mod ${mod} = [${sums.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { piles, k, sums },
    };
    step += 1;
    // ponytail: brute-force winning move; closed-form bit rule when input grows.
    let move: number[] | null = null;
    if (!losing) {
        const idx = piles.map((_, i) => i);
        const subsets: number[][] = [];
        const gen = (rest: number[], take: number, start: number): void => {
            if (take === 0) {
                subsets.push([...rest]);
                return;
            }
            for (let i = start; i < idx.length; i += 1)
                gen([...rest, idx[i] as number], take - 1, i + 1);
        };
        for (let t = 1; t <= k; t += 1) gen([], t, 0);
        search: for (const s of subsets) {
            const ranges = s.map((i) => Array.from({ length: piles[i] ?? 0 }, (_, d) => d + 1));
            const combo: number[] = new Array<number>(s.length).fill(1);
            for (;;) {
                const np = [...piles];
                s.forEach((pi, j) => {
                    np[pi] = (np[pi] ?? 0) - (combo[j] ?? 1);
                });
                if (bitSums(np, mod).every((v) => v === 0)) {
                    move = np;
                    break search;
                }
                let c = 0;
                while (c < combo.length) {
                    combo[c] = (combo[c] ?? 1) + 1;
                    if ((combo[c] ?? 1) <= (ranges[c]?.length ?? 0)) break;
                    combo[c] = 1;
                    c += 1;
                }
                if (c >= combo.length) break;
            }
        }
    }
    if (!move) {
        yield {
            stepNumber: step,
            entities: pileCells(piles),
            edges: [],
            description:
                "All digit sums are 0 mod (k+1) – a P-position, losing for the player to move.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { piles, k, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: pileCells(piles),
            edges: [],
            description: `Moore's Nim_${k} [${piles.join(", ")}] is losing for the player to move.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { piles, k, winning: false },
        };
        return;
    }
    const taken = piles.map((v, i) => v - (move as number[])[i]);
    yield {
        stepNumber: step,
        entities: pileCells(
            piles,
            new Set(taken.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0)),
        ),
        edges: [],
        description: `Winning move: take ${taken
            .map((t, i) => (t > 0 ? `${t} from pile ${i + 1}` : ""))
            .filter(Boolean)
            .join(", ")} -> [${(move as number[]).join(", ")}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { piles, k, after: move },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: pileCells(move),
        edges: [],
        description: `Result [${move.join(", ")}] has digit sums [${bitSums(move, mod).join(", ")}] – a P-position.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { piles: move, k, winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: pileCells(move),
        edges: [],
        description: `First player wins Moore's Nim_${k} [${piles.join(", ")}] with this move.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { piles: move, k, winning: true },
    };
}

const module: AlgorithmModule = {
    id: "moores-nim",
    name: "Moore's Nim",
    category: "game",
    complexity: { time: "O(m^p)", space: "O(p)" },
    defaultInput: { piles: [3, 4, 5], k: 2 },
    visualType: "grid",
    run,
};

export default module;
