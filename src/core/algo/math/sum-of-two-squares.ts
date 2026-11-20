/**
 * sum-of-two-squares.ts - Sum of Two Squares (Two-Pointer Search)
 *
 * Given a nonnegative integer n, decide whether n = a^2 + b^2 for integers
 * a, b >= 0 and, when possible, exhibit a witness pair. A two-pointer scan
 * starts with a at 0 and b at floor(sqrt(n)); it raises a when the current sum
 * is too small and lowers b when it is too large. Every candidate pair is
 * visited exactly once, so the search is O(sqrt(n)).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    a: number,
    b: number,
    sum: number,
    target: number,
    found: boolean,
): VisualEntity[] {
    const values: Array<[string, number]> = [
        ["a", a],
        ["b", b],
        ["a^2+b^2", sum],
        ["target", target],
    ];
    return values.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${label}=${value}`,
        value,
        state: found && label === "a^2+b^2" ? "sorted" : label === "target" ? "highlight" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 2), col: index % 2, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const n = typeof input === "number" ? Math.max(0, Math.floor(input)) : 65;
    const frames: VisualFrame[] = [];
    const push = (a: number, b: number, sum: number, found: boolean, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(a, b, sum, n, found),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: { a, b, sum, n, found, rows: 2, cols: 2 },
        });
    };

    let a = 0;
    let b = Math.floor(Math.sqrt(n));
    push(a, b, a * a + b * b, false, `Testing whether ${n} is a sum of two squares.`, 0);

    let found = false;
    while (a <= b) {
        const sum = a * a + b * b;
        if (sum === n) {
            found = true;
            push(a, b, sum, true, `${n} = ${a}^2 + ${b}^2 - witness found.`, 3);
            break;
        }
        if (sum < n) {
            push(a, b, sum, false, `Sum ${sum} is too small: increase a.`, 2);
            a += 1;
        } else {
            push(a, b, sum, false, `Sum ${sum} is too large: decrease b.`, 3);
            b -= 1;
        }
    }
    if (!found) {
        push(a, b, a * a + b * b, false, `${n} is not a sum of two squares.`, 4);
    }

    for (const frame of frames) {
        yield frame;
    }
    yield {
        stepNumber: frames.length,
        entities: makeCells(a, b, a * a + b * b, n, found),
        edges: [],
        description: found
            ? `Done: ${n} = ${a}^2 + ${b}^2.`
            : `Done: no representation of ${n} as a sum of two squares exists.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { n, found, a, b, rows: 2, cols: 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine a grid of candidate pairs (a, b). Start with a at zero and b at the largest value whose square can fit. If the sum is too small, a must move up; if it is too large, b must move down. This walk covers every possible pair without ever revisiting one.",
        invariants: [
            "a never decreases and b never increases during the scan.",
            "Every pair with a leading coordinate at most the current a has already been rejected.",
            "The pointers stop once a exceeds b, so all unordered pairs have been considered.",
        ],
        correctness:
            "For a fixed a the value a^2+b^2 grows with b. When the sum is below n, increasing a is the only way to reach larger sums not already ruled out; when it is above n, decreasing b is the only way to reduce it. Because each move is monotone and the search space is finite, the loop visits all candidate pairs and stops exactly on a witness or when none can exist.",
        complexityRationale:
            "a increases at most sqrt(n) times and b decreases at most sqrt(n) times, so the scan is O(sqrt(n)) with O(1) working storage.",
        uses: [
            "Deciding which integers are sums of two squares in number-theory software",
            "Constructing Pythagorean triples and lattice points on circles",
            "Testing representability before factoring-based algorithms",
        ],
        references: [
            "Niven, Zuckerman and Montgomery, An Introduction to the Theory of Numbers, chapter on sums of squares",
            "Hardy and Wright, An Introduction to the Theory of Numbers, Theorem 366",
        ],
        workedExample:
            "For n = 65, start a = 0, b = 8 giving 64, which is too small. Raise a to 1 giving 65 = 1 + 64, so the witness is (1, 8).",
    },
    id: "sum-of-two-squares",
    name: "Sum of Two Squares",
    category: "math",
    complexity: { time: "O(sqrt n)", space: "O(1)" },
    defaultInput: 65,
    visualType: "grid",
    run,
    pseudocode: [
        "read the target integer n",
        "set a to 0 and b to floor(sqrt n)",
        "while a is at most b, form s = a^2 + b^2",
        "if s equals n, report the pair (a, b) and stop",
        "if s is less than n, increase a; otherwise decrease b",
        "done: report that no representation exists",
    ],
};

export default module;
