/**
 * quadratic-integer-factorization.ts - Splitting of Primes in Z[sqrt(d)]
 *
 * For a squarefree integer d the rational prime p either splits into two
 * distinct prime ideals, stays inert, or ramifies in the ring of integers of
 * Q(sqrt d). The Kronecker symbol (D/p), with D the field discriminant,
 * decides the case. When p splits this module also exhibits the two prime
 * ideals (p, sqrt(d) - x) and (p, sqrt(d) + x) with x^2 = d mod p.
 *
 * Limit: exact brute-force search for x, so p stays small (default <= 100).
 *
 * Time:  O(p) per prime to locate a square root modulo p
 * Space: O(1) per prime
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type SplitType = "split" | "inert" | "ramified";

interface Factorization {
    p: number;
    discriminant: number;
    symbol: number;
    type: SplitType;
    x: number | null;
    ideals: string[];
}

function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

function powMod(base: number, exp: number, m: number): number {
    let result = 1;
    let b = mod(base, m);
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % m;
        b = (b * b) % m;
        e = Math.floor(e / 2);
    }
    return result;
}

function legendre(a: number, p: number): number {
    const value = mod(a, p);
    if (value === 0) return 0;
    const r = powMod(value, Math.floor((p - 1) / 2), p);
    return r === 1 ? 1 : r === p - 1 ? -1 : 0;
}

function kronecker(D: number, p: number): number {
    if (p === 2) {
        if (D % 2 === 0) return 0;
        const r = mod(D, 8);
        return r === 1 || r === 7 ? 1 : r === 3 || r === 5 ? -1 : 0;
    }
    return legendre(D, p);
}

function squareRootMod(a: number, p: number): number | null {
    const target = mod(a, p);
    for (let x = 0; x < p; x += 1) {
        if (mod(x * x, p) === target) return x;
    }
    return null;
}

function factorize(d: number, p: number): Factorization {
    const discriminant = mod(d, 4) === 1 ? d : 4 * d;
    const symbol = kronecker(discriminant, p);
    if (symbol === 0) {
        return {
            p,
            discriminant,
            symbol,
            type: "ramified",
            x: 0,
            ideals: p > 2 && mod(d, p) === 0 ? [`(p, sqrt(d))`] : [`(${p})^2`],
        };
    }
    if (symbol === -1) {
        return { p, discriminant, symbol, type: "inert", x: null, ideals: [`(p)`] };
    }
    const x = squareRootMod(d, p);
    if (x === null) {
        return { p, discriminant, symbol, type: "inert", x: null, ideals: [`(p)`] };
    }
    return {
        p,
        discriminant,
        symbol,
        type: "split",
        x,
        ideals: [`(p, sqrt(d)-${x})`, `(p, sqrt(d)+${x})`],
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { d?: number; primes?: number[] } | null) ?? {};
    const d = typeof task.d === "number" ? task.d : 2;
    const primes = task.primes ?? [3, 5, 7, 11, 17, 23, 2];
    const factors = primes.map((p) => factorize(d, p));

    const makeEntities = (focus: number): VisualEntity[] => {
        const f = factors[focus];
        if (!f) return [];
        const fields: Array<[string, string]> = [
            ["d", String(d)],
            ["D", String(f.discriminant)],
            ["p", String(f.p)],
            ["(D/p)", String(f.symbol)],
            ["type", f.type],
            ...f.ideals.map((ideal, i): [string, string] => [`ideal ${i + 1}`, ideal]),
        ];
        return fields.map(([label, value], index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${label}: ${value}`,
            value,
            state: (index === 4 ? "active" : "idle") as "active" | "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, field: label },
        }));
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Factoring ${primes.length} rational primes in the ring of integers of Q(sqrt(${d})).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 0, cols: 0, primes, d, count: primes.length },
    };
    step += 1;

    for (let i = 0; i < factors.length; i += 1) {
        const f = factors[i]!;
        yield {
            stepNumber: step,
            entities: makeEntities(i),
            edges: [],
            description:
                f.type === "split"
                    ? `p=${f.p}: (D/p)=1, so p splits as ${f.ideals.join(" * ")} with x=${f.x}, x^2 = ${d} mod ${f.p}.`
                    : f.type === "inert"
                      ? `p=${f.p}: (D/p)=-1, so p is inert and (p) stays prime with norm ${f.p * f.p}.`
                      : `p=${f.p}: (D/p)=0, so p ramifies as ${f.ideals.join(" ")}.`,
            codeLineNumber: f.type === "split" ? 5 : f.type === "inert" ? 3 : 2,
            layout: "grid",
            meta: {
                rows: 1,
                cols: f.ideals.length + 5,
                p: f.p,
                d,
                discriminant: f.discriminant,
                symbol: f.symbol,
                type: f.type,
                x: f.x,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Classified ${factors.length} prime(s): ${factors.filter((f) => f.type === "split").length} split, ${factors.filter((f) => f.type === "inert").length} inert, ${factors.filter((f) => f.type === "ramified").length} ramified.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: 0,
            cols: 0,
            split: factors.filter((f) => f.type === "split").length,
            inert: factors.filter((f) => f.type === "inert").length,
            ramified: factors.filter((f) => f.type === "ramified").length,
        },
    };
}

const module: AlgorithmModule = {
    id: "quadratic-integer-factorization",
    name: "Prime Factorization in Quadratic Integer Rings",
    category: "math",
    complexity: { time: "O(p) per prime", space: "O(1) per prime" },
    defaultInput: { d: 2, primes: [3, 5, 7, 11, 17, 23, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the field discriminant D from the squarefree d",
        "for each rational prime p evaluate the Kronecker symbol (D/p)",
        "if the symbol is zero declare p ramified and stop for this p",
        "if the symbol is minus one declare p inert with ideal (p) of norm p squared",
        "if the symbol is plus one search for x with x squared congruent to d mod p",
        "form the prime ideals (p, sqrt(d)-x) and (p, sqrt(d)+x) of norm p",
        "record the factorization type and continue with the next prime",
        "done: report split, inert, and ramified counts",
    ],
    education: {
        intuition:
            "A rational prime need not stay prime once you enlarge the integers to include sqrt(d). Depending on whether d is a square modulo p, the prime either breaks into two conjugate factors, remains prime, or becomes a square of a prime. The Kronecker symbol encodes exactly which case occurs.",
        invariants: [
            "The discriminant D is d when d = 1 mod 4 and 4d otherwise.",
            "A split prime yields two distinct prime ideals whose norms both equal p.",
            "An inert prime yields one prime ideal (p) whose norm is p squared.",
        ],
        correctness:
            "The quotient Z[sqrt(d)]/(p) is F_p[x]/(x^2-d). When d is a nonresidue this quotient is the field F_p^2, so (p) remains prime. When d is a residue the polynomial factors as (x-x0)(x+x0), giving two maximal ideals of norm p. When p divides the discriminant the polynomial has a repeated root, which is the ramified case. The symbol (D/p) is precisely this quadratic character.",
        complexityRationale:
            "Evaluating the symbol costs O(log p), while locating x when p splits scans at most p residues, so each prime costs O(p). Only constant-size ideal descriptors are retained per prime.",
        uses: [
            "Computing prime decompositions in algebraic number fields",
            "Constructing prime ideals for cryptographic protocols over quadratic fields",
            "Deciding which primes are represented by a binary quadratic form",
        ],
        references: [
            "Marcus, Number Fields, chapter 5",
            "Cohen, A Course in Computational Algebraic Number Theory, chapter 4",
        ],
        workedExample:
            "For d = 2 and p = 7, the discriminant is 8 and (8/7) = 1. Since 3^2 = 2 mod 7, the prime splits as (7, sqrt(2)-3)(7, sqrt(2)+3), each factor having norm 7. For p = 3 the symbol is -1, so 3 stays inert with norm 9.",
    },
};

export default module;
