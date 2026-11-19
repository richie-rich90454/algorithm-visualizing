/**
 * powersort.ts - Powersort (Munro and Wild, 2018)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Powersort is a stable merge sort that first locates the natural ascending or
 * descending runs already present in the input, then decides the merge order
 * from the "power" of each boundary between neighboring runs. The power is the
 * number of times two divides the distance between the two run midpoints in
 * normalized coordinates. A stack keeps powers weakly increasing; a new run of
 * lower power forces all higher-power runs to merge first. This is the merge
 * policy used in CPython 3.11 in place of timsort's ad hoc collapse rules.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) worst, O(n log k) merges when k natural runs exist
 *   Space: O(n) for the merge buffer plus O(log n) stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A natural run is YELLOW (comparing) while it is detected.
 *   - The boundary power is shown in the caption and statistics panel.
 *   - The two fronts of an active merge are PINK (highlight).
 *   - Fully merged runs turn GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Run {
    start: number;
    end: number;
}

interface StackRun extends Run {
    power: number;
}

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

/** The binary power of the boundary between two adjacent runs. */
function boundaryPower(a: Run, b: Run, n: number): number {
    const midA = (a.start + (a.end - a.start) / 2) / n;
    const midB = (b.start + (b.end - b.start) / 2) / n;
    let power = 0;
    while (power < 31 && Math.floor(midA * 2 ** power) === Math.floor(midB * 2 ** power)) {
        power += 1;
    }
    return power;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const arr = Array.isArray(task.values) ? [...task.values] : [4, 5, 7, 1, 2, 3, 9, 8, 6, 0];
    const n = arr.length;
    const temp: number[] = new Array(n);
    let step = 0;
    let merges = 0;
    let mergeCost = 0;

    const emit = (
        description: string,
        codeLineNumber: number,
        states: Map<number, EntityState> = new Map(),
        extra: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { merges, mergeCost, runs: 0, ...extra },
    });

    yield emit("Powersort: locate existing runs, assign each boundary a power, then merge the stack in power order.", 0);
    step += 1;

    if (n === 0) {
        yield emit("Empty array - nothing to sort.", 6, new Map(), { runs: 0, sorted: true });
        return;
    }

    // Detect natural runs, reversing strictly descending ones in place.
    const runs: Run[] = [];
    let cursor = 0;
    while (cursor < n) {
        const start = cursor;
        if (cursor + 1 < n && (arr[cursor + 1] as number) >= (arr[cursor] as number)) {
            while (cursor + 1 < n && (arr[cursor + 1] as number) >= (arr[cursor] as number)) {
                cursor += 1;
            }
            cursor += 1;
        } else {
            while (cursor + 1 < n && (arr[cursor + 1] as number) < (arr[cursor] as number)) {
                cursor += 1;
            }
            let lo = start;
            let hi = cursor + 1;
            while (lo < hi) {
                const tmp = arr[lo] as number;
                arr[lo] = arr[hi - 1] as number;
                arr[hi - 1] = tmp;
                lo += 1;
                hi -= 1;
            }
            cursor += 1;
        }
        runs.push({ start, end: cursor });
    }

    const runStates = new Map<number, EntityState>();
    for (const r of runs) {
        for (let k = r.start; k < r.end; k += 1) {
            runStates.set(k, "comparing");
        }
    }
    yield emit(`Detected ${runs.length} natural run(s) spanning ${n} value(s).`, 1, runStates, {
        runs: runs.length,
    });
    step += 1;

    function* merge(left: Run, right: Run): Generator<VisualFrame, void, unknown> {
        for (let k = left.start; k < right.end; k += 1) {
            temp[k] = arr[k] as number;
        }
        let i = left.start;
        let j = right.start;
        for (let k = left.start; k < right.end; k += 1) {
            const takeLeft = i < left.end && (j >= right.end || (temp[i] as number) <= (temp[j] as number));
            const states = new Map<number, EntityState>();
            if (i < left.end) {
                states.set(i, "highlight");
            }
            if (j < right.end) {
                states.set(j, "highlight");
            }
            yield emit(
                `Merging [${left.start}..${left.end - 1}] with [${right.start}..${right.end - 1}]: take ${takeLeft ? "left" : "right"} front.`,
                4,
                states,
                { runs: runs.length, leftRun: `${left.start}-${left.end - 1}`, rightRun: `${right.start}-${right.end - 1}` },
            );
            step += 1;
            if (takeLeft) {
                arr[k] = temp[i] as number;
                i += 1;
            } else {
                arr[k] = temp[j] as number;
                j += 1;
            }
        }
        merges += 1;
        mergeCost += right.end - left.start;
        const mergedStates = new Map<number, EntityState>();
        for (let k = left.start; k < right.end; k += 1) {
            mergedStates.set(k, "sorted");
        }
        yield emit(`Merged run [${left.start}..${right.end - 1}] into sorted order.`, 5, mergedStates, {
            runs: runs.length,
        });
        step += 1;
    }

    const stack: StackRun[] = [];
    let current: Run = runs[0] as Run;
    for (let k = 1; k < runs.length; k += 1) {
        const next = runs[k] as Run;
        const power = boundaryPower({ start: current.start, end: current.end }, next, n);
        yield emit(
            `Boundary ${current.end - 1}/${current.end} has power ${power}; stack top has ${stack.length > 0 ? (stack[stack.length - 1] as StackRun).power : "none"}.`,
            2,
            new Map([[current.end - 1, "comparing"], [current.end, "comparing"]]),
            { runs: runs.length, power },
        );
        step += 1;
        while (stack.length > 0 && (stack[stack.length - 1] as StackRun).power > power) {
            const top = stack.pop() as StackRun;
            yield* merge(top, current);
            current = { start: top.start, end: current.end };
        }
        stack.push({ start: current.start, end: current.end, power });
        current = next;
    }

    while (stack.length > 0) {
        const top = stack.pop() as StackRun;
        yield emit(`Draining stack: run of power ${top.power} merges with the final run.`, 3, new Map(), {
            runs: runs.length,
            power: top.power,
        });
        step += 1;
        yield* merge(top, current);
        current = { start: top.start, end: current.end };
    }

    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, "sorted"]));
    yield emit(`Powersort finished with merge cost ${mergeCost} over ${merges} merge(s).`, 6, finalStates, {
        runs: runs.length,
        sorted: true,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of cutting the array in half blindly, powersort uses the sorted streaks that already exist. Each gap between two streaks gets a small integer called its power: gaps near powers-of-two boundaries have high power and must be merged first. A stack of runs keeps those powers ordered, giving a natural merge order with almost no bookkeeping.",
        invariants: [
            "Every run on the stack is internally sorted.",
            "Powers on the stack are weakly increasing from bottom to top.",
            "A run is popped and merged only when a strictly smaller boundary power arrives.",
        ],
        correctness:
            "Natural runs are sorted by construction, and a reverse of a strictly descending run is sorted. Merging two sorted runs yields a sorted run, so every stack entry and the current run stay sorted. The stack is fully drained at the end, leaving one sorted run that contains every input value exactly once.",
        complexityRationale:
            "Each merge costs time linear in the combined run length, and the power rule keeps the total merge cost within a constant factor of the optimum for k runs, which is O(n log k); the worst case is O(n log n). The merge buffer uses O(n) space and the run stack O(log n).",
        uses: [
            "CPython 3.11 list.sort as a drop-in replacement for the timsort merge policy",
            "Stable sorting of nearly sorted data such as database result streams",
            "Any application that wants near-optimal adaptivity to existing order",
        ],
        references: [
            "Munro and Wild, Powersort: A Near-Optimal Stable Mergesort, ESA 2018",
            "Wikipedia, Powersort",
        ],
        workedExample:
            "In 4, 5, 7, 1, 2, 3, 9, 8, 6, 0 the natural runs are 4,5,7 then 1,2,3 then 9 then 8 then 6 then 0. The boundary powers decide that the short descending singletons merge first, producing longer runs before the two big ascending runs are joined.",
    },
    id: "powersort",
    name: "Powersort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: [4, 5, 7, 1, 2, 3, 9, 8, 6, 0],
    visualType: "array",
    run,
    pseudocode: [
        "scan the array for maximal natural runs",
        "reverse each strictly descending run in place",
        "for each pair of neighboring runs compute the boundary power",
        "while the stack top has greater power, pop and merge it with the current run",
        "push the current run and its power on the stack",
        "after all runs arrive, drain the stack by merging",
        "done: the single remaining run is the sorted array",
    ],
};

export default module;
