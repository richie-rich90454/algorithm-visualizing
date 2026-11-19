/**
 * fibonacci-fast-doubling.ts - Fibonacci by Fast Doubling.
 *
 * Uses the identities F(2m) = F(m) * (2*F(m+1) - F(m)) and
 * F(2m+1) = F(m)^2 + F(m+1)^2. Scanning the binary digits of n from most
 * significant to least computes F(n) in O(log n) arithmetic operations.
 *
 * Time O(log n), space O(1).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(a: number, b: number, bit: string, done: boolean): VisualEntity[] {
    const values = [
        { label: "F(m)", value: a },
        { label: "F(m+1)", value: b },
        { label: "bit", value: bit === "1" ? 1 : 0 },
    ];
    return values.map((entry, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: `${entry.label}=${entry.value}`,
        value: entry.value,
        state: (done ? "sorted" : i === 2 ? "comparing" : "active") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { field: entry.label, row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(0, Math.trunc(task.n)) : 10;
    const bin = n.toString(2);
    let a = 0;
    let b = 1;
    let step = 0;

    yield {
        stepNumber: step,
        entities: cells(a, b, "", false),
        edges: [],
        description: `Compute F(${n}) by scanning its ${bin.length} binary digits (${bin}) from left to right.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, m: 0, a, b, bit: "" },
    };
    step += 1;

    for (const bit of bin) {
        const c = a * (2 * b - a);
        const d = a * a + b * b;
        if (bit === "0") {
            a = c;
            b = d;
        } else {
            a = d;
            b = c + d;
        }
        yield {
            stepNumber: step,
            entities: cells(a, b, bit, false),
            edges: [],
            description: `Digit ${bit}: F(2m)=${c}, F(2m+1)=${d}; now (F(m),F(m+1))=(${a},${b}).`,
            codeLineNumber: bit === "0" ? 2 : 3,
            layout: "grid",
            meta: { n, a, b, bit, double: c, odd: d },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(a, b, "", true),
        edges: [],
        description: `Done: F(${n}) = ${a}, and F(${n + 1}) = ${b}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { n, result: a, next: b },
    };
}

const module: AlgorithmModule = {
    id: "fibonacci-fast-doubling",
    name: "Fibonacci Fast Doubling",
    category: "math",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { n: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "write n in binary and start (a,b) = (F(0),F(1)) = (0,1)",
        "for each binary digit of n from most to least significant",
        "c <- a*(2*b - a) (= F(2m)) and d <- a*a + b*b (= F(2m+1))",
        "if digit is 0 set (a,b) <- (c,d), else set (a,b) <- (d,c+d)",
        "after all digits return a (= F(n))",
    ],
    education: {
        intuition:
            "Each binary digit doubles the index computed so far. A pair of algebraic identities gives F(2m) and F(2m+1) directly from F(m) and F(m+1), so one step per input bit replaces the linear sequence of additions.",
        invariants: [
            "After processing a prefix of the bits, (a,b) always equals (F(m),F(m+1)) for m equal to that binary prefix.",
            "The doubling identities hold for every nonnegative m.",
            "a and b never decrease as the index grows (for n at least 1).",
        ],
        correctness:
            "The identities follow from the addition formula F(p+q)=F(p-1)F(q)+F(p)F(q+1) with p=q=m and p=m+1, q=m. Processing a binary digit maps (F(m),F(m+1)) to either the pair at index 2m or at index 2m+1, so after the final digit the pair is exactly (F(n),F(n+1)).",
        complexityRationale:
            "There is one constant-time iteration per binary digit of n, so the running time is O(log n). Only a fixed number of scalar variables are kept, giving O(1) space.",
        uses: [
            "Computing huge Fibonacci numbers in arbitrary-precision libraries",
            "Fast matrix-power alternatives in competitive programming",
            "Deriving closed forms and identities in number theory",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 1, Section 1.2.8",
            "CP-algorithms, Fibonacci Numbers",
        ],
        workedExample:
            "For n=10 (binary 1010), starting from (0,1) the digits produce (1,1), then (1,2), then (5,8), then (55,89). The final a is 55, which is F(10).",
    },
};

export default module;
