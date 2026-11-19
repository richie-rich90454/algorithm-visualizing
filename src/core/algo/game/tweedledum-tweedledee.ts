/**
 * tweedledum-tweedledee.ts - The Tweedledum-Tweedledee Mirroring Strategy
 *
 * In the sum of two identical impartial games, the second player can always win
 * by answering every move in one component with the same move in the other.
 * The two components stay identical after each pair of replies, so the mirroring
 * player is never the first to run out of moves. In Sprague-Grundy terms the sum
 * has nimber g xor g, which is always zero.
 *
 * This module demonstrates the strategy on a subtraction game where a move
 * removes one to three tokens from a single heap, and it verifies the claim by
 * brute-force Grundy search over the two-heap position.
 *
 * Time O(heap * maxRemove) for the single-heap table plus O(moves) replay;
 * space O(heap) for the cached nimbers.
 *
 * Visualization: two bars are the paired heaps. The mover's heap turns yellow,
 * the reply turns green, and the final frame shows both heaps empty.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface TweedleInput {
    heap?: number;
    maxRemove?: number;
    firstMove?: number;
}

/** Grundy values for a single heap in the subtraction game. */
function heapGrundy(maxHeap: number, maxRemove: number): number[] {
    const values: number[] = [0];
    for (let size = 1; size <= maxHeap; size += 1) {
        const seen = new Set<number>();
        for (let remove = 1; remove <= maxRemove && remove <= size; remove += 1) {
            seen.add(values[size - remove] ?? 0);
        }
        let nimber = 0;
        while (seen.has(nimber)) nimber += 1;
        values.push(nimber);
    }
    return values;
}

/** Brute-force Grundy value of a two-heap sum, computed from its options. */
function sumGrundy(
    left: number,
    right: number,
    maxRemove: number,
    single: number[],
    memo: Map<string, number>,
): number {
    const key = `${left},${right}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const seen = new Set<number>();
    for (let remove = 1; remove <= maxRemove; remove += 1) {
        if (left - remove >= 0) {
            seen.add(sumGrundy(left - remove, right, maxRemove, single, memo));
        }
        if (right - remove >= 0) {
            seen.add(sumGrundy(left, right - remove, maxRemove, single, memo));
        }
    }
    let nimber = 0;
    while (seen.has(nimber)) nimber += 1;
    memo.set(key, nimber);
    return nimber;
}

function makeEntities(left: number, right: number, active: "left" | "right" | "none"): VisualEntity[] {
    return [
        {
            id: "heap-left",
            type: "bar" as const,
            label: String(left),
            value: left,
            state: (active === "left" ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 0, heap: "left", size: left },
        },
        {
            id: "heap-right",
            type: "bar" as const,
            label: String(right),
            value: right,
            state: (active === "right" ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: 1, heap: "right", size: right },
        },
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TweedleInput | null) ?? {};
    const heap = Math.max(0, Math.min(20, Math.floor(Number(task.heap ?? 7)) || 0));
    const maxRemove = Math.max(1, Math.min(6, Math.floor(Number(task.maxRemove ?? 3)) || 3));
    const single = heapGrundy(heap, maxRemove);
    const memo = new Map<string, number>();
    const startValue = sumGrundy(heap, heap, maxRemove, single, memo);
    let left = heap;
    let right = heap;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(left, right, "none"),
        edges: [],
        description: `Two identical heaps of ${heap}; the sum has Grundy value ${startValue}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { left, right, singleGrundy: single[heap] ?? 0, sumGrundy: startValue, move: 0, mirror: 0 },
    };
    step += 1;

    let round = 0;
    while (left > 0 || right > 0) {
        let amount = Math.floor(Number(task.firstMove ?? 1)) || 1;
        if (amount < 1 || amount > maxRemove || amount > left) amount = Math.min(maxRemove, left);
        if (amount < 1) break;
        left -= amount;
        yield {
            stepNumber: step,
            entities: makeEntities(left, right, "left"),
            edges: [],
            description: `Round ${round + 1}: first player removes ${amount} from the left heap.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { left, right, singleGrundy: single[left] ?? 0, sumGrundy: sumGrundy(left, right, maxRemove, single, memo), move: amount, mirror: 0 },
        };
        step += 1;

        right -= amount;
        yield {
            stepNumber: step,
            entities: makeEntities(left, right, "right"),
            edges: [],
            description: `Second player mirrors by removing ${amount} from the right heap; the heaps are equal again.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { left, right, singleGrundy: single[right] ?? 0, sumGrundy: sumGrundy(left, right, maxRemove, single, memo), move: amount, mirror: amount },
        };
        step += 1;
        round += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(left, right, "none"),
        edges: [],
        description: `Both heaps are empty after ${round} mirrored round(s); the second player made the last move.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { left, right, singleGrundy: 0, sumGrundy: 0, move: 0, mirror: 0, rounds: round, completed: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a game is made of two copies of the same subgame, the second player never has to invent a strategy. Whatever the first player does in one copy, the second player repeats in the other. The paired position is restored after every reply, so the first player is always the one facing an empty pair of heaps.",
        invariants: [
            "After each mirrored reply the two heaps have equal size again.",
            "The number removed by the reply always equals the number just removed by the opponent.",
            "A paired position has Grundy value zero because its two nimbers are identical.",
        ],
        correctness:
            "For disjoint impartial games the Sprague-Grundy value of a sum is the bitwise xor of the component values. A position with value zero is losing for the player to move, and g xor g is always zero. The mirror move is legal because the untouched copy still contains exactly the tokens the opponent just removed from the other copy. The brute-force search over the two-heap game confirms the zero value without relying on the xor theorem.",
        complexityRationale:
            "The single-heap table needs one mex computation per size, each scanning at most maxRemove options, giving O(heap * maxRemove) time and O(heap) space. Replaying the strategy emits a constant number of frames per round and at most heap rounds.",
        uses: [
            "Building an unbeatable strategy for symmetric board games",
            "Explaining the xor rule for sums of impartial games",
            "Checking game engines for symmetry exploitation",
        ],
        references: [
            "Conway, On Numbers and Games, Chapter 1",
            "Berlekamp, Conway and Guy, Winning Ways for Your Mathematical Plays, Volume 1",
        ],
        workedExample:
            "Start with two heaps of seven in a game where one to three tokens may be removed. If the first player takes two from the left heap, the second takes two from the right heap. Both heaps are now five, and the pattern repeats until the first player faces two empty heaps and loses.",
    },
    id: "tweedledum-tweedledee",
    name: "Tweedledum-Tweedledee Strategy",
    category: "game",
    complexity: { time: "O(heap * maxRemove)", space: "O(heap)" },
    defaultInput: { heap: 7, maxRemove: 3, firstMove: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "compute single-heap Grundy values by mex of options",
        "start from two identical heaps",
        "while tokens remain in either heap do",
        "let the first player remove tokens from one heap",
        "remove the same number from the other heap",
        "observe that the heaps are equal again",
        "done: report the mirrored play and final Grundy value",
    ],
};

export default module;
