/**
 * extended-euclid.ts – Extended Euclid's Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The extended Euclidean algorithm not only finds gcd(a, b) but also the
 * *Bezout coefficients* x, y such that a·x + b·y = gcd(a, b). It tracks the
 * coefficients alongside the remainders: each step computes the next pair of
 * coefficients from the previous two, exactly mirroring how the remainders
 * themselves are generated.
 *
 * These coefficients are exactly what is needed to compute modular inverses.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log min(a, b))
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current (a, b) pair is YELLOW (comparing).
 *   - The current Bezout coefficients are reported each step.
 *   - The final coefficients are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The Bezout identity is the algebraic heart of modular arithmetic.
 *   - RSA key generation uses these coefficients constantly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a pair of bar entities for the current (a, b).
 *
 * @param a The first number.
 * @param b The second number.
 * @param states Optional index → state overrides.
 * @returns Two bar entities.
 */
function makeBars(
    a: number,
    b: number,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return [
        { value: a, label: String(a) },
        { value: b, label: String(b) },
    ].map((item, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: item.label,
        value: item.value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Extended Euclid generator.
 *
 * @param input `{ a, b }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number } | null) ?? {};
    let a = typeof task.a === "number" ? task.a : 48;
    let b = typeof task.b === "number" ? task.b : 36;

    // Coefficients: a = oldR · x + oldS · y is maintained at every step.
    let oldR = a;
    let r = b;
    let oldX = 1;
    let x = 0;
    let oldY = 0;
    let y = 1;

    let step = 0;
    let iterations = 0;

    // Frame 0: the starting numbers.
    yield {
        stepNumber: step,
        entities: makeBars(oldR, r),
        edges: [],
        description: `Extended gcd(${a}, ${b}) – tracking Bezout coefficients.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iterations },
    };
    step += 1;

    // The Euclidean loop, extended with coefficient tracking.
    while (r !== 0) {
        const quotient = Math.floor(oldR / r);

        const states = new Map<number, EntityState>([
            [0, "comparing"],
            [1, "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(oldR, r, states),
            edges: [],
            description: `${oldR} = ${quotient}·${r} + ${oldR % r} (coefficients x=${oldX}, y=${oldY}).`,
            codeLineNumber: 2,
            layout: "array",
            meta: { iterations },
        };
        step += 1;

        // Update the remainder triple.
        const nextR = oldR - quotient * r;
        oldR = r;
        r = nextR;

        // Update the x-coefficient triple.
        const nextX = oldX - quotient * x;
        oldX = x;
        x = nextX;

        // Update the y-coefficient triple.
        const nextY = oldY - quotient * y;
        oldY = y;
        y = nextY;

        iterations += 1;
    }

    // oldR = gcd, oldX/oldY are the Bezout coefficients.
    const gcd = oldR;
    const bezoutX = oldX;
    const bezoutY = oldY;

    const finalStates = new Map<number, EntityState>([
        [0, "sorted"],
        [1, "idle"],
    ]);
    yield {
        stepNumber: step,
        entities: makeBars(gcd, 0, finalStates),
        edges: [],
        description: `gcd = ${gcd} with ${a}·(${bezoutX}) + ${b}·(${bezoutY}) = ${gcd}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { iterations, gcd, bezoutX, bezoutY },
    };
}

/** The Extended Euclid module, registered with the engine. */
const module: AlgorithmModule = {
    id: "extended-euclid",
    name: "Extended Euclid",
    category: "math",
    complexity: { time: "O(log min(a, b))", space: "O(1)" },
    // gcd(48, 36) = 12 with 48·(1) + 36·(-1) = 12.
    defaultInput: { a: 48, b: 36 },
    visualType: "array",
    run,
};

export default module;
