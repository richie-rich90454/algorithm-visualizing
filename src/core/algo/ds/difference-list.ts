/**
 * difference-list.ts - Difference List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A difference list represents a list as a function that prepends its own
 * contents to an arbitrary tail: the value stands for "my elements followed
 * by xs". Appending an element is a single function composition, so building
 * a list by repeated snoc costs O(1) per step and the final conversion to an
 * ordinary list costs O(n), avoiding the quadratic behavior of repeated
 * naive concatenation on the left.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * The composition chain is stored as an ordered list of single-element
 * segments, which is the exact semantic content of the function composition.
 * This is a purely functional model; no lazy evaluation, sharing analysis, or
 * physical runtime representation is simulated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   snoc:    O(1) amortized
 *   toList:  O(n)
 *   Space:   O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the segments composed so far, in order.
 *   - The newest segment is highlighted as it is appended.
 *   - The final frame shows the fully applied ordinary list.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeBars(values: number[], active: number, applied: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (applied ? "sorted" : index === active ? "active" : "comparing") as VisualEntity["state"],
        x: index,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value, position: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) ? task.values.filter((v) => typeof v === "number") : [3, 1, 4, 1, 5];

    const segments: number[] = [];
    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Start with the empty difference list, the identity function that leaves any tail unchanged.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { segments: 0, values: [...values] },
    };
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] ?? 0;
        segments.push(value);
        yield {
            stepNumber: step,
            entities: makeBars(segments, segments.length - 1, false),
            edges: [],
            description: `Snoc ${value} by composing one more segment onto the front of the difference list; no earlier segment is copied.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { segments: segments.length, value, applied: false },
        };
        step += 1;
    }

    const result = [...segments];
    yield {
        stepNumber: step,
        entities: makeBars(result, -1, true),
        edges: [],
        description: `Apply the composed function to the empty tail to obtain the concrete list of ${result.length} element(s).`,
        codeLineNumber: 4,
        layout: "array",
        meta: { segments: segments.length, list: result, applied: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of storing a list directly, store a recipe for appending that list in front of whatever tail you are given. The empty list is the recipe that changes nothing, and adding one element is just composing another small recipe onto the front. Because composition never touches the earlier pieces, repeated appends stay cheap.",
        invariants: [
            "A difference list denotes its own elements followed by an arbitrary tail xs.",
            "Snoc composes a single-element segment without copying earlier segments.",
            "Applying the composition to the empty tail yields exactly the list of appended elements in order.",
        ],
        correctness:
            "Let D(xs) denote the list represented by a difference list. The identity function represents the empty list, so D([]) is empty. Snoc with value v is defined as the composition D'(xs) = D(v :: xs), which prepends v before the tail and then applies the old recipe, so the new representation is the old elements followed by v. By induction on the number of snocs, applying the final composition to [] produces the appended values in their original order.",
        complexityRationale:
            "Each snoc adds one composition node and takes constant time, so building n elements is O(n), and converting to an ordinary list walks the composition once for O(n) time. The n stored segments use O(n) space.",
        uses: [
            "Building output lists in functional parsers without quadratic concatenation",
            "Efficient difference-list-based show and pretty-printer accumulators",
            "Log message accumulation in pure functional runtimes",
        ],
        references: [
            "Hughes, The Design and Implementation of Functional Programming Languages (1987)",
            "Okasaki, Purely Functional Data Structures (1998)",
        ],
        workedExample:
            "Starting from the identity, snoc 3 then snoc 1 then snoc 4 builds the recipe that maps a tail xs to 3 :: 1 :: 4 :: xs. Applying it to the empty tail gives the list 3, 1, 4, with no element copied more than once during construction.",
    },
    id: "difference-list",
    name: "Difference List",
    category: "data-structures",
    complexity: { time: "O(1) snoc, O(n) toList", space: "O(n)" },
    defaultInput: { values: [3, 1, 4, 1, 5] },
    visualType: "array",
    run,
    pseudocode: [
        "let the difference list be the identity function",
        "for each value to append",
        "compose a segment holding that value in front of the recipe",
        "continue until all values are appended",
        "apply the finished composition to the empty tail",
        "report the resulting ordinary list",
    ],
};

export default module;
