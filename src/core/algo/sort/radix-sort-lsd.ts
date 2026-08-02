/**
 * radix-sort-lsd.ts – Radix Sort (LSD, least-significant digit first)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Radix sort sorts numbers digit by digit. The LSD variant starts from the
 * least significant digit and performs one *stable* pass per digit position,
 * each pass sorting the array by that digit. Because each pass is stable,
 * elements that share a digit retain the relative order established by the
 * previous, more significant passes – so after the final (most significant)
 * digit pass, the array is fully sorted.
 *
 * Here each digit pass is implemented with counting sort on the digit bucket.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d × (n + b)) where d is the number of digits and b the base (10)
 *   Space: O(n + b) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The digit being examined is YELLOW (comparing).
 *   - Elements being re-ordered in a digit pass are PINK (highlight).
 *   - The fully sorted array turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable, provided each digit pass is stable.
 *   - Non-comparison: beats comparison sorts when d is small relative to log n.
 *   - With base 10, d ≈ log₁₀(max), so overall it is O(n · log₁₀(max)).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The current array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with placeholder positions.
 */
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

/**
 * Extract a single decimal digit from a number.
 *
 * @param value The number to inspect.
 * @param place The digit position: 0 = units, 1 = tens, 2 = hundreds, …
 * @returns The digit (0–9) at that position.
 */
function digitAt(value: number, place: number): number {
    return Math.floor(Math.abs(value) / 10 ** place) % 10;
}

/**
 * The Radix Sort (LSD) generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [170, 45, 75, 90, 802, 24, 2, 66];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – radix sort will sort digit by digit, LSD first.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    if (arr.length === 0) {
        return;
    }

    // The number of digit passes equals the digit count of the largest value.
    const maxValue = Math.max(...arr.map(Math.abs));
    const maxDigits = String(maxValue).length;

    // One stable counting-sort pass per digit position, LSD → MSD.
    for (let place = 0; place < maxDigits; place += 1) {
        // Buckets 0–9 hold elements by their current digit.
        const buckets: number[][] = Array.from({ length: 10 }, () => []);

        // Distribute every element into its digit bucket.
        for (let i = 0; i < arr.length; i += 1) {
            const value = arr[i];
            if (value === undefined) {
                continue;
            }
            const digit = digitAt(value, place);
            (buckets[digit] ?? []).push(value);

            const digitStates = new Map<number, EntityState>([[i, "comparing"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, digitStates),
                edges: [],
                description: `Digit pass ${place + 1}: ${value} goes into bucket ${digit} (${String(10 ** place)}s place).`,
                codeLineNumber: 2,
                layout: "array",
                meta: { digitPlace: place },
            };
            step += 1;
        }

        // Reassemble the array in bucket order, preserving within-bucket order
        // (this is what keeps every pass stable).
        let index = 0;
        for (let d = 0; d < 10; d += 1) {
            const bucket = buckets[d];
            if (!bucket) {
                continue;
            }
            for (const value of bucket) {
                arr[index] = value;
                index += 1;
            }
        }

        const passStates = new Map<number, EntityState>([[place, "highlight"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, passStates),
            edges: [],
            description: `Pass ${place + 1} complete – array ordered by the ${String(10 ** place)}s digit.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { digitPlace: place },
        };
        step += 1;
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted with ${maxDigits} stable digit passes.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { digitPasses: maxDigits },
    };
}

/** The Radix Sort (LSD) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "radix-sort-lsd",
    name: "Radix Sort (LSD)",
    category: "sorting",
    complexity: { time: "O(d(n + b))", space: "O(n + b)" },
    // Mixed magnitudes (802 vs 2) make the multi-digit passes instructive.
    defaultInput: [170, 45, 75, 90, 802, 24, 2, 66],
    visualType: "array",
    run,
};

export default module;
