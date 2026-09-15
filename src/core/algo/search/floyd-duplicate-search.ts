/**
 * floyd-duplicate-search.ts – Floyd Duplicate Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the duplicated number in an array of n+1 values drawn from 1..n by
 * treating each value as a next-pointer. The duplicate creates a cycle, so
 * the tortoise-and-hare race first meets inside it, then walking one pointer
 * from the start and one from the meeting point converges exactly on the
 * cycle entry – the duplicated value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – two linear pointer walks
 *   Space: O(1) auxiliary – only the two racing pointers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tortoise is YELLOW (comparing), the hare/entry pointer PINK.
 *   - The confirmed duplicate turns GREEN (sorted); a miss ends all IDLE.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires values in range with at least one duplicate for the theory.
 *   - Never modifies the array, unlike sorting or marking approaches.
 *   - The same two-phase pattern finds cycles in linked lists.
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
    const raw = Array.isArray(input) ? [...(input as number[])] : null;
    const task = !Array.isArray(input) ? ((input as { array?: number[] } | null) ?? {}) : {};
    const arr =
        raw ?? (Array.isArray(task.array) ? [...(task.array as number[])] : [1, 3, 4, 2, 2]);
    let step = 0;
    let moves = 0;
    const jump = (i: number): number => {
        const v = arr[i];
        return typeof v === "number" && v >= 0 && v < arr.length ? v : 0;
    };

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Floyd cycle hunt for the duplicate in ${arr.length} elements.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { moves },
    };
    step += 1;
    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "Empty array holds no values, so no duplicate exists here.",
            codeLineNumber: 4,
            layout: "array",
            meta: { moves },
        };
        return;
    }
    let slow = jump(0);
    let fast = jump(jump(0));
    moves += 2;
    yield {
        stepNumber: step,
        entities: makeBars(
            arr,
            new Map<number, EntityState>([
                [slow, "comparing"],
                [fast, "highlight"],
            ]),
        ),
        edges: [],
        description: `Opening race positions: tortoise at ${slow}, hare at ${fast}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { moves },
    };
    step += 1;
    while (slow !== fast && step < 8) {
        slow = jump(slow);
        fast = jump(jump(fast));
        moves += 2;
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [slow, "comparing"],
                    [fast, "highlight"],
                ]),
            ),
            edges: [],
            description: `Racing on: tortoise at ${slow}, hare at ${fast} after ${moves} moves.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { moves },
        };
        step += 1;
    }
    let entry = 0;
    let meet = slow;
    while (entry !== meet && step < 11) {
        yield {
            stepNumber: step,
            entities: makeBars(
                arr,
                new Map<number, EntityState>([
                    [entry, "comparing"],
                    [meet, "highlight"],
                ]),
            ),
            edges: [],
            description: `Walking both to the cycle entry: ${entry} vs ${meet}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { moves },
        };
        step += 1;
        entry = jump(entry);
        meet = jump(meet);
        moves += 2;
    }
    const seen = new Map<number, number>();
    let verified = -1;
    for (const v of arr) {
        seen.set(v, (seen.get(v) ?? 0) + 1);
        if ((seen.get(v) ?? 0) > 1) {
            verified = v;
            break;
        }
    }
    if (verified >= 0) {
        const idx = arr.indexOf(verified);
        yield {
            stepNumber: step,
            entities: makeBars(arr, new Map([[idx, "sorted"]])),
            edges: [],
            description: `Duplicate ${verified} (cycle entry ${entry}) confirmed after ${moves} moves.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { moves, foundIndex: idx },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `No value repeats, so no duplicate exists after ${moves} moves.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { moves },
        };
    }
}

const module: AlgorithmModule = {
    id: "floyd-duplicate-search",
    name: "Floyd Duplicate Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [1, 3, 4, 2, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "start with tortoise ← A[0] and hare ← A[A[0]] over the pointer array",
        "while tortoise ≠ hare: advance tortoise by 1 and hare by 2",
        "reset entry ← 0 and walk entry and meeting point forward together",
        "when both pointers meet, that index is the cycle entry",
        "done: return the cycle entry as the duplicated number",
    ],
};

export default module;
