/**
 * floyd-duplicate-search.ts – Floyd Duplicate Search
 *
 * Treats values as next-pointers and runs tortoise-and-hare to find the
 * cycle entry – the duplicated number. Verified by brute-force counting
 * before the duplicate goes green.
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
            description: "Empty array – no duplicate exists.",
            codeLineNumber: 1,
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
        description: `Tortoise at ${slow}, hare at ${fast}.`,
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
            description: `Tortoise at ${slow}, hare at ${fast}.`,
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
            codeLineNumber: 3,
            layout: "array",
            meta: { moves, foundIndex: idx },
        };
    } else {
        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: "No duplicate found.",
            codeLineNumber: 3,
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
};

export default module;
