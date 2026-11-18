import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * even-perfect-numbers-euler – Even Perfect Numbers.
 * 2^(p-1)(2^p-1) is perfect iff Mp = 2^p-1 is prime.
 * Default p=5: Mp=31 prime, perfect 496. Time O(2^p).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 5;
    let step = 0;
    if (!(p >= 2) || p > 13) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 2 <= p <= 13).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const mp = 2 ** p - 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle"), C(0, 1, `M=${mp}`, mp, "highlight")],
        edges: [],
        description: `Mersenne M${p} = 2^${p}-1 = ${mp}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { mp },
    };
    step += 1;
    let prime = true;
    for (let d = 2; d * d <= mp; d += 1) {
        const r = mp - Math.trunc(mp / d) * d;
        if (d <= 3) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `M=${mp}`, mp, "comparing"), C(0, 1, `d=${d}`, d, "idle")],
                edges: [],
                description: `${mp} mod ${d} = ${r}${r === 0 ? " – composite" : ""}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { step },
            };
            step += 1;
        }
        if (r === 0) {
            prime = false;
            break;
        }
    }
    if (!prime) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `M=${mp}`, mp, "swapped")],
            edges: [],
            description: `M${p} = ${mp} composite – no perfect number here.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { perfect: false },
        };
        return;
    }
    const perf = 2 ** (p - 1) * mp;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${perf}`, perf, "comparing")],
        edges: [],
        description: `M${p} prime – perfect = 2^${p - 1} x ${mp} = ${perf}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { perf },
    };
    step += 1;
    let s = 0;
    for (let d = 1; d < perf; d += 1) if (perf - Math.trunc(perf / d) * d === 0) s += d;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${perf}`, perf, s === perf ? "sorted" : "swapped")],
        edges: [],
        description: `Divisor sum ${s} ${s === perf ? "= " + perf + " – PERFECT" : "!= " + perf}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { perf, perfect: s === perf },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "An even perfect number equals the sum of its proper divisors. Euler proved that every even perfect number has the form 2^(p-1)*(2^p - 1) where 2^p - 1 is a Mersenne prime. The visualization builds that candidate from p, checks whether the Mersenne factor is prime, and verifies the divisor sum.",
        "invariants": [
            "The candidate is n = 2^(p-1)*Mp with Mp = 2^p - 1.",
            "If Mp is prime then the Euclid-Euler theorem guarantees n is perfect.",
            "The sum of all divisors of n is 2n exactly when n is perfect."
        ],
        "correctness": "Euclid showed the form yields a perfect number when Mp is prime, and Euler proved the converse for even perfect numbers. Trial division decides primality of Mp, so when it succeeds the constructed n must be perfect. Summing the divisors gives 2n as an independent check.",
        "complexityRationale": "Trial division of Mp, which is near 2^p, costs O(sqrt(Mp)) = O(2^(p/2)) time, matching the stated O(2^p) bound conservatively. Space is O(1) since only the candidate and a running divisor sum are kept.",
        "uses": [
            "Generating even perfect numbers from Mersenne primes",
            "Exploring the connection between perfect numbers and Mersenne primes",
            "Verifying the Euclid-Euler theorem computationally"
        ],
        "references": [
            "Euclid, Elements, Book IX, Proposition 36",
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 1"
        ],
        "workedExample": "For p = 5, Mp = 31 is prime, so n = 2^4*31 = 496. Its proper divisors sum to 1+2+4+8+16+31+62+124+248 = 496, confirming 496 is perfect."
    },
    id: "even-perfect-numbers-euler",
    name: "Even Perfect Numbers",
    category: "math",
    complexity: { time: "O(2^p)", space: "O(1)" },
    defaultInput: { p: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "form the Mersenne number Mp = 2^p − 1",
        "trial-divide Mp by small factors",
        "prime Mp yields 2^(p−1)·Mp, else stop here",
        "verify by summing all the divisors",
        "done: perfect number confirmed, or none for this p",
    ],
};
export default module;
