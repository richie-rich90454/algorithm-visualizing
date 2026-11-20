/**
 * pythagorean-triples.ts - Primitive Pythagorean Triples by Euclid's Formula.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Euclid's formula generates primitive Pythagorean triples: for integers
 * m>n>0 that are coprime and of opposite parity, the numbers a=m^2-n^2,
 * b=2mn, c=m^2+n^2 satisfy a^2+b^2=c^2 and share no common factor. Enumerating
 * such pairs (m,n) yields every primitive triple exactly once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M^2 log M) for m up to M with a gcd check per pair
 *   Space: O(t) for t generated triples in the result table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each grid row is a generated triple with its m, n, a, b and c.
 *   - Rejected (m,n) pairs are shown with an error state before being skipped.
 *   - The newest accepted row is highlighted; the final frame lists the count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PythagoreanInput {
    limit?: number;
}

interface Row {
    m: number;
    n: number;
    a: number;
    b: number;
    c: number;
    accepted: boolean;
}

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const r = x % y;
        x = y;
        y = r;
    }
    return x;
}

function makeEntities(rows: Row[], done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i]!;
        const values: Array<[string, number]> = [
            ["m", row.m],
            ["n", row.n],
            ["a", row.a],
            ["b", row.b],
            ["c", row.c],
        ];
        values.forEach(([name, value], col) => {
            const state: EntityState = done
                ? "sorted"
                : !row.accepted
                    ? "error"
                    : i === rows.length - 1
                        ? "highlight"
                        : "idle";
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: `${name}=${value}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PythagoreanInput | null) ?? {};
    const limit = typeof task.limit === "number" && task.limit > 0
        ? Math.trunc(task.limit)
        : 100;
    const rows: Row[] = [];
    let accepted = 0;

    yield {
        stepNumber: 0,
        entities: [],
        edges: [],
        description: `Enumerating coprime opposite-parity pairs m>n with m^2+n^2 at most ${limit}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: 5, limit, accepted: 0 },
    };

    const maxM = Math.floor(Math.sqrt(limit)) + 1;
    for (let m = 2; m <= maxM; m += 1) {
        for (let n = 1; n < m; n += 1) {
            const c = m * m + n * n;
            if (c > limit) {
                continue;
            }
            const validParity = (m - n) % 2 === 1;
            const coprime = gcd(m, n) === 1;
            const ok = validParity && coprime;
            const row: Row = {
                m,
                n,
                a: m * m - n * n,
                b: 2 * m * n,
                c,
                accepted: ok,
            };
            if (!ok) {
                continue;
            }
            rows.push(row);
            accepted += 1;
            yield {
                stepNumber: accepted,
                entities: makeEntities(rows, false),
                edges: [],
                description: `m=${m}, n=${n} gives the primitive triple (${row.a}, ${row.b}, ${row.c}).`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { rows: rows.length, cols: 5, limit, accepted, last: [row.a, row.b, row.c] },
            };
        }
    }

    yield {
        stepNumber: accepted + 1,
        entities: makeEntities(rows, true),
        edges: [],
        description: `Done: found ${accepted} primitive Pythagorean triple(s) with c at most ${limit}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: rows.length, cols: 5, limit, accepted, count: accepted },
    };
}

const module: AlgorithmModule = {
    id: "pythagorean-triples",
    name: "Pythagorean Triples",
    category: "math",
    complexity: { time: "O(M^2 log M)", space: "O(t)" },
    defaultInput: { limit: 100 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a hypotenuse limit for the triples",
        "for each pair of integers m greater than n",
        "if m and n are coprime and have opposite parity",
        "emit a = m^2 - n^2, b = 2mn, c = m^2 + n^2 when c is within the limit",
        "done: report all primitive triples found",
    ],
    education: {
        intuition:
            "Every primitive right triangle with whole-number sides comes from two integers m and n. Squaring and adding them produces the hypotenuse, squaring and subtracting produces one leg, and doubling their product produces the other. Requiring m and n to be coprime and of opposite parity removes the non-primitive duplicates.",
        invariants: [
            "Every emitted row satisfies a squared plus b squared equals c squared.",
            "Every emitted row has gcd(a, b, c) equal to 1.",
            "m and n used for an emitted row are coprime and of opposite parity.",
            "Each primitive triple is produced by exactly one ordered pair (m,n).",
        ],
        correctness:
            "Expanding (m^2-n^2)^2 + (2mn)^2 gives (m^2+n^2)^2, so Euclid's formula always produces a Pythagorean triple. A standard number-theory argument shows the triple is primitive exactly when m and n are coprime and of opposite parity, and that every primitive triple has such a representation, so the enumeration is both sound and complete.",
        complexityRationale:
            "The outer loops consider all pairs m>n up to the square root of the limit, about M squared pairs, and each gcd check costs O(log M), giving O(M squared log M) time. Only the accepted triples are stored, so space is O(t) for t results.",
        uses: [
            "Generating integer-sided right triangles for geometry and games",
            "Teaching parametrization of Diophantine equations",
            "Testing primitivity and factorization routines",
        ],
        references: [
            "Hardy and Wright, An Introduction to the Theory of Numbers, Pythagorean triples",
            "Wikipedia, Pythagorean triple, Euclid's formula",
        ],
        workedExample:
            "With m=2 and n=1 the formula gives a=3, b=4, c=5. With m=3 and n=2 it gives a=5, b=12, c=13. With m=2 and n=2 the parity test fails and the pair is skipped.",
    },
};

export default module;
