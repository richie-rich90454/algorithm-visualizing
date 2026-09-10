/**
 * wythoff.ts – Wythoff's Game
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Wythoff's game is a two-pile Nim variant: a move removes any positive number
 * of stones from one pile, OR the same number from both piles. The losing
 * positions are exactly the pairs (⌊n·φ⌋, ⌊n·φ²⌋) for n ≥ 0, where
 * φ = (1 + √5)/2 is the golden ratio. These are called "cold" positions and
 * form the Wythoff pairs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per position check via the golden-ratio formula
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two piles are shown as bars.
 *   - One frame lists the cold pairs n=0..5 from the floor(n·φ) formula,
 *     marking the input's n; the verdict keeps the n-1/n/n+1 safety check.
 *   - A winning position shows the move to the reachable cold pair
 *     (single-pile or diagonal take, exact numbers) and the resulting bars;
 *     a cold position shows one sample reply and why it is hot.
 *   - A cold (losing) position is RED (swapped).
 *   - A winning position is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The golden ratio appearing in a game is the delight of the theory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pair of bars for the two piles.
 *
 * @param a Pile A size.
 * @param b Pile B size.
 * @param state The state color for both bars.
 * @returns Two bar entities.
 */
function makeBars(a: number, b: number, state: EntityState): VisualEntity[] {
    return [a, b].map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Wythoff generator.
 *
 * @param input `{ a, b }` – the two pile sizes.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 8;
    const b = typeof task.b === "number" ? task.b : 13;

    let step = 0;

    // Frame 0: the two piles.
    yield {
        stepNumber: step,
        entities: makeBars(a, b, "idle"),
        edges: [],
        description: `Wythoff's game with piles (${a}, ${b}).`,
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // The golden ratio.
    const phi = (1 + Math.sqrt(5)) / 2;
    const cold = (n: number): [number, number] => [Math.floor(n * phi), Math.floor(n * phi * phi)];

    // Cold-pair table n = 0..5 with the input's n marked.
    const lo0 = Math.min(a, b);
    const hi0 = Math.max(a, b);
    const nearN = Math.round(lo0 / phi);
    const tableRows = [0, 1, 2, 3, 4, 5].map((n) => {
        const [x, y] = cold(n);
        return `n=${n} (${x}, ${y})${n === nearN ? " ← input n" : ""}`;
    });
    yield {
        stepNumber: step,
        entities: makeBars(a, b, "idle"),
        edges: [],
        description: `Cold pairs (⌊n·φ⌋, ⌊n·φ²⌋): ${tableRows.join("; ")}. Input (${lo0}, ${hi0}) sits near n=${nearN}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phi: phi.toFixed(6), nearN, coldTable: tableRows },
    };
    step += 1;

    // A position is cold iff (min, max) = (⌊n·φ⌋, ⌊n·φ²⌋) for some n.
    const min = Math.min(a, b);
    const max = Math.max(a, b);

    // Solve n from the smaller coordinate: n ≈ min / φ.
    const n = Math.round(min / phi);
    const coldMin = Math.floor(n * phi);
    const coldMax = Math.floor(n * phi * phi);

    // Also check n-1, n, n+1 for safety.
    const isCold =
        (coldMin === min && coldMax === max) ||
        (Math.floor((n - 1) * phi) === min && Math.floor((n - 1) * phi * phi) === max) ||
        (Math.floor((n + 1) * phi) === min && Math.floor((n + 1) * phi * phi) === max);

    const isColdPair = (x: number, y: number): boolean => {
        const lo = Math.min(x, y);
        const hi = Math.max(x, y);
        const m = Math.round(lo / phi);
        return [m - 1, m, m + 1].some(
            (t) => Math.floor(t * phi) === lo && Math.floor(t * phi * phi) === hi,
        );
    };

    yield {
        stepNumber: step,
        entities: makeBars(a, b, isCold ? "swapped" : "sorted"),
        edges: [],
        description: isCold
            ? `(${min}, ${max}) is a cold (losing) position – a Wythoff pair.`
            : `(${min}, ${max}) is a winning position.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { cold: isCold, phi: phi.toFixed(6), nearN: n },
    };
    step += 1;

    if (!isCold) {
        // Winning move: the reachable cold pair taking the fewest stones.
        // Enumerate cold pairs by m (they grow linearly, so m stops past max).
        let best: { na: number; nb: number; take: number; diagonal: boolean } | null = null;
        if (Number.isFinite(max) && max <= 200000) {
            for (let m = 0; ; m += 1) {
                const [c1, c2] = cold(m);
                if (c1 > max) break;
                const placements: Array<[number, number]> =
                    c1 === c2
                        ? [[c1, c2]]
                        : [
                              [c1, c2],
                              [c2, c1],
                          ];
                for (const [na, nb] of placements) {
                    if (na > a || nb > b || (na === a && nb === b)) continue;
                    const da = a - na;
                    const db = b - nb;
                    const diagonal = da === db && da > 0;
                    const single = (da === 0 && db > 0) || (db === 0 && da > 0);
                    if (!diagonal && !single) continue;
                    if (!isColdPair(na, nb)) continue;
                    const take = da + db;
                    if (best === null || take < best.take) {
                        best = { na, nb, take, diagonal };
                    }
                }
            }
        }
        if (best === null) {
            yield {
                stepNumber: step,
                entities: makeBars(a, b, "sorted"),
                edges: [],
                description: `(${min}, ${max}) is winning, but no single reply is enumerated for these piles here.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: false },
            };
        } else {
            const moveText = best.diagonal
                ? `take ${best.take / 2} from both piles (${a}, ${b}) → (${best.na}, ${best.nb})`
                : best.na === a
                  ? `take ${b - best.nb} from the second pile (${a}, ${b}) → (${best.na}, ${best.nb})`
                  : `take ${a - best.na} from the first pile (${a}, ${b}) → (${best.na}, ${best.nb})`;
            yield {
                stepNumber: step,
                entities: makeBars(a, b, "comparing"),
                edges: [],
                description: `Winning move (${best.diagonal ? "diagonal take" : "single-pile take"}): ${moveText}, a cold pair.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: false, toA: best.na, toB: best.nb, take: best.take },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeBars(best.na, best.nb, "swapped"),
                edges: [],
                description: `After the move (${best.na}, ${best.nb}) – cold (losing) for the next player, so (${a}, ${b}) is winning.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true, a: best.na, b: best.nb },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeBars(best.na, best.nb, "swapped"),
                edges: [],
                description: `First player wins Wythoff's game from (${a}, ${b}) via (${best.na}, ${best.nb}).`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true, winning: true },
            };
        }
    } else {
        // Cold position: show one sample reply and why it hands back a hot position.
        const bigIsA = a >= b;
        const mover: "a" | "b" | null = a > 0 || b > 0 ? (bigIsA ? "a" : "b") : null;
        if (mover === null) {
            yield {
                stepNumber: step,
                entities: makeBars(a, b, "swapped"),
                edges: [],
                description: `No legal move – (${a}, ${b}) is the terminal cold pair n=0.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeBars(a, b, "swapped"),
                edges: [],
                description: `(${a}, ${b}) is losing for the player to move.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true, winning: false },
            };
        } else {
            const na = mover === "a" ? a - 1 : a;
            const nb = mover === "b" ? b - 1 : b;
            const rMin = Math.min(na, nb);
            const rMax = Math.max(na, nb);
            const rk = rMax - rMin;
            const [rc1, rc2] = cold(rk);
            yield {
                stepNumber: step,
                entities: makeBars(a, b, "comparing"),
                edges: [],
                description: `Sample reply: take 1 from the ${mover === "a" ? "first" : "second"} pile (${a}, ${b}) → (${na}, ${nb}).`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true, toA: na, toB: nb },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeBars(na, nb, "sorted"),
                edges: [],
                description: `After the reply (${rMin}, ${rMax}): difference ${rk} wants cold (${rc1}, ${rc2}), so (${rMin}, ${rMax}) is hot (winning) for the next player.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: false, a: na, b: nb },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: makeBars(na, nb, "sorted"),
                edges: [],
                description: `Every reply from cold (${a}, ${b}) hands the opponent a hot position – (${a}, ${b}) is losing.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { cold: true, winning: false },
            };
        }
    }
}

/** The Wythoff module, registered with the engine. */
const module: AlgorithmModule = {
    id: "wythoff",
    name: "Wythoff's Game",
    category: "game",
    complexity: { time: "O(1)", space: "O(1)" },
    // (8, 13) is the cold Wythoff pair n=5 (a losing position).
    defaultInput: { a: 8, b: 13 },
    visualType: "array",
    run,
};

export default module;
