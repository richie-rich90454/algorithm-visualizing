/**
 * williams-p-plus-one.ts - Williams' p+1 Factorization Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Williams' p+1 method factors an integer n by exploiting a prime factor p
 * for which p+1 is smooth. It evaluates a Lucas sequence modulo n at a
 * highly composite index M; when p+1 divides M and the Lucas discriminant is
 * a non-residue modulo p, the value V_M is congruent to 2 modulo p, so the
 * gcd of V_M minus 2 with n reveals p.
 *
 * The simulation is exact BigInt arithmetic. It is a teaching model: the
 * smoothness bound and the number of tested Lucas parameters are capped so
 * the frame sequence stays finite.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * log M * log^2 n) for P parameter choices
 *   Space: O(log M + log n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the gcd obtained for each Lucas parameter.
 *   - A gcd strictly between one and n is highlighted as the found factor.
 *   - The final frame reports the factor and its cofactor.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface WilliamsInput {
    n?: number;
    bound?: number;
    maxParameters?: number;
}

/** Greatest common divisor for BigInt. */
function gcd(a: bigint, b: bigint): bigint {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Highly composite exponent: the least common multiple of one through bound. */
function smoothExponent(bound: number): bigint {
    let m = 1n;
    for (let base = 2; base <= bound; base += 1) {
        let prime = base;
        for (let d = 2; d * d <= prime; d += 1) {
            if (prime % d === 0) {
                prime = 0;
                break;
            }
        }
        if (prime === 0) continue;
        let power = 1n;
        while (power * BigInt(base) <= BigInt(bound)) power *= BigInt(base);
        m = (m * power) / gcd(m, power);
    }
    return m;
}

/**
 * Compute (V_k, V_{k+1}) for the Lucas sequence with Q = 1 using binary
 * doubling. All operations are modulo mod.
 */
function lucasPair(k: bigint, parameter: bigint, mod: bigint): [bigint, bigint] {
    let v0 = 2n % mod;
    let v1 = parameter % mod;
    const bits = k.toString(2);
    for (let i = 0; i < bits.length; i += 1) {
        const next0 = (v0 * v0 - 2n + mod) % mod;
        const next1 = (v0 * v1 - parameter % mod + mod) % mod;
        if (bits[i] === "0") {
            v0 = next0;
            v1 = next1;
        } else {
            v0 = next1;
            v1 = (v1 * v1 - 2n + mod) % mod;
        }
    }
    return [v0, v1];
}

/** Bars for the tested parameters and gcd results. */
function makeBars(values: number[], highlight: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `param-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: index === highlight ? "sorted" : "comparing",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, gcd: value },
    }));
}

/** The Williams p+1 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as WilliamsInput | null) ?? {};
    const n = Math.max(15, Math.floor(Number(task.n) || 407));
    const bound = Math.max(4, Math.min(30, Math.floor(Number(task.bound) || 15)));
    const maxParameters = Math.max(1, Math.min(24, Math.floor(Number(task.maxParameters) || 16)));
    const modulus = BigInt(n);
    const exponent = smoothExponent(bound);
    const gcds: number[] = [];
    const parameters: number[] = [];
    let factor = 0;
    let usedParameter = 0;

    const metaBase = {
        n,
        bound,
        exponent: exponent.toString(),
        parameters: [] as number[],
        gcds: [] as number[],
        factor,
        cofactor: 0,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([n], -1),
        edges: [],
        description: `Factoring ${n} with a smoothness bound of ${bound}; the exponent M is ${exponent.toString()}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...metaBase },
    };
    step += 1;

    for (let p = 3; p < maxParameters + 3; p += 1) {
        const [v] = lucasPair(exponent, BigInt(p), modulus);
        const d = gcd(v - 2n, modulus);
        const asNumber = Number(d);
        parameters.push(p);
        gcds.push(asNumber);
        if (asNumber > 1 && asNumber < n) {
            factor = asNumber;
            usedParameter = p;
            break;
        }
        yield {
            stepNumber: step,
            entities: makeBars(gcds, -1),
            edges: [],
            description: `Lucas parameter ${p} gave gcd ${asNumber}; ${asNumber === n ? "the whole number" : "no nontrivial factor"} was found.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { ...metaBase, parameters: [...parameters], gcds: [...gcds] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(gcds, factor ? gcds.length - 1 : -1),
        edges: [],
        description: factor
            ? `Parameter ${usedParameter} revealed factor ${factor}; the cofactor is ${n / factor}.`
            : `No factor found with the tested parameters; increase the smoothness bound and retry.`,
        codeLineNumber: factor ? 2 : 3,
        layout: "array",
        meta: {
            ...metaBase,
            parameters: [...parameters],
            gcds: [...gcds],
            factor,
            cofactor: factor ? n / factor : 0,
        },
    };
}

/** The Williams p+1 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fermat's little theorem turns a smooth exponent into a factor when p minus one is smooth. Williams' p+1 method is the Lucas-sequence cousin: it works when p plus one is smooth instead. It walks a recurrence that lives in a quadratic extension of the field modulo p, and a highly composite number of steps brings the sequence back to the value two modulo p, which a gcd exposes.",
        invariants: [
            "Every Lucas value is reduced modulo n, so all arithmetic stays bounded.",
            "The exponent is divisible by every prime power up to the smoothness bound.",
            "Any nontrivial gcd of V_M minus 2 with n is a genuine divisor of n.",
        ],
        correctness:
            "When the discriminant P squared minus four is a quadratic non-residue modulo p, the roots of the Lucas characteristic polynomial lie in the extension field with p squared elements, whose multiplicative group has order p squared minus one. The Lucas sequence then has period dividing p plus one. Because M is divisible by p plus one, V_M is congruent to V_0 which equals two modulo p, so p divides the gcd. If the gcd is neither one nor n, it is a proper factor of n.",
        complexityRationale:
            "The exponent has O(log M) bits and each binary-doubling step uses a constant number of modular multiplications of O(log n)-bit integers, giving O(log M log squared n) per parameter. Testing a capped number of parameters multiplies that cost, and only a handful of BigInt values are stored.",
        uses: [
            "Factoring integers whose prime factors have smooth p plus one",
            "A historical step on the path to elliptic-curve factorization",
            "A teaching contrast with Pollard p minus one and Pollard rho",
        ],
        references: [
            "Williams, A p+1 Method of Factoring, 1982",
            "Crandall and Pomerance, Prime Numbers: A Computational Perspective, Chapter 7",
        ],
        workedExample:
            "For n equals 407 equals 11 times 37, the factor 11 has 11 plus one equal to 12, which divides the smooth exponent built from small primes. With a suitable Lucas parameter, V_M is two modulo 11 but not modulo 37, so the gcd of V_M minus 2 with 407 is 11 and the cofactor is 37.",
    },
    id: "williams-p-plus-one",
    name: "Williams p+1 Factorization",
    category: "math",
    complexity: { time: "O(P log M log^2 n)", space: "O(log M + log n)" },
    defaultInput: { n: 407, bound: 15 },
    visualType: "array",
    run,
    pseudocode: [
        "build M as the least common multiple up to the bound",
        "for each Lucas parameter P from three upward",
        "compute V_M of the sequence with Q equal one mod n",
        "set d to the gcd of V_M minus two and n",
        "if d is strictly between one and n, report d",
        "otherwise try the next parameter",
        "done: report the factor and cofactor, or failure",
    ],
};

export default module;
