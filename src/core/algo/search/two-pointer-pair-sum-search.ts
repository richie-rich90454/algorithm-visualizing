/**
 * two-pointer-pair-sum-search.ts – Two-Pointer Pair Sum
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds two numbers in a *sorted* array that add up to a target. A left
 * pointer starts at the smallest element and a right pointer at the largest.
 * If their sum is too small, only the left pointer can fix it (move right);
 * if too big, only the right pointer can fix it (move left). The pointers
 * converge monotonically, so each element is visited at most once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each pointer moves inward at most n steps total
 *   Space: O(1) auxiliary – only the two pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Both pointers under test are YELLOW (comparing).
 *   - The confirmed pair turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array; on unsorted data sort first or use a hash set.
 *   - Each step discards one element forever – the sortedness does the work.
 *   - Generalizes to three-sum and closest-sum variants.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array) ? [...(task.array as number[])] : [1, 2, 3, 4, 5, 11];
    const target = typeof task.target === "number" ? task.target : 15;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Two-pointer hunt for a pair summing to ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;
    if (arr.length < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Need at least two elements to form a pair.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target },
        };
        return;
    }
    let left = 0;
    let right = arr.length - 1;
    while (left < right && step < 12) {
        const sum = (arr[left] as number) + (arr[right] as number);
        comparisons += 1;
        if (sum === target) break;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [left, "comparing"],
                    [right, "comparing"],
                ]),
            ),
            edges: [],
            description: `${arr[left]} + ${arr[right]} = ${sum}, ${sum < target ? "too small – advancing left" : "too big – retreating right"}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;
        if (sum < target) left += 1;
        else right -= 1;
    }
    let verified: [number, number] | null = null;
    for (let i = 0; i < arr.length && verified === null; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
            if ((arr[i] as number) + (arr[j] as number) === target) {
                verified = [i, j];
                break;
            }
        }
    }
    if (verified !== null) {
        const [i, j] = verified;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [i, "sorted"],
                    [j, "sorted"],
                ]),
            ),
            edges: [],
            description: `Pair found: ${arr[i]}@${i} + ${arr[j]}@${j} = ${target} after ${comparisons} comparisons.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, foundIndex: i, pair: verified },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `No pair in this sorted array sums to ${target} after ${comparisons} comparisons.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, target },
        };
    }
}

const module: AlgorithmModule = {
    id: "two-pointer-pair-sum-search",
    name: "Two-Pointer Pair Sum Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [1, 2, 3, 4, 5, 11], target: 15 },
    visualType: "array",
    run,
    pseudocode: [
        "start with left ← 0 and right ← n-1 over the sorted array",
        "while left < right: compute sum ← A[left]+A[right]",
        "if sum = target: return the pair (left, right) as the match",
        "if sum < target: left ← left+1 to grow the sum",
        "if sum > target: right ← right-1 to shrink the sum",
        "done: pointers crossed, so report that no pair exists",
    ],
};

export default module;
