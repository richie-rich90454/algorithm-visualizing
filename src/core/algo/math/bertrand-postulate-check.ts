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
 * bertrand-postulate-check – Bertrand's Postulate Check.
 * Finds a prime p with n < p < 2n by trial division scan.
 * Default n=10 witnesses p=11. Time O(n sqrt(n)).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 10;
    let step = 0;
    if (!(n >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const isPrime = (v: number): boolean => {
        if (v < 2) return false;
        for (let d = 2; d * d <= v; d += 1) if (v - Math.trunc(v / d) * d === 0) return false;
        return true;
    };
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `2n=${2 * n}`, 2 * n, "idle")],
        edges: [],
        description: `Seek prime p with ${n} < p < ${2 * n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const cands: number[] = [];
    for (let v = n + 1; v < 2 * n; v += 1) cands.push(v);
    yield {
        stepNumber: step,
        entities: cands.slice(0, 9).map((v, i) => C(0, i, `${v}`, v, "idle")),
        edges: [],
        description: `Candidates ${n + 1}..${2 * n - 1}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const w = cands.find(isPrime) as number;
    for (const d of [2, 3]) {
        const r = w - Math.trunc(w / d) * d;
        yield {
            stepNumber: step,
            entities: [C(0, 0, `w=${w}`, w, "comparing"), C(0, 1, `d=${d}`, d, "idle")],
            edges: [],
            description: `${w} mod ${d} = ${r} – not divisible.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { step },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${w}`, w, "sorted")],
        edges: [],
        description: `Witness p=${w}: ${n} < ${w} < ${2 * n} – postulate holds.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { witness: w },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Bertrand's postulate says that for any n greater than 1 there is at least one prime strictly between n and 2n. This visualization checks the claim for a chosen n by scanning the candidates n+1 through 2n-1 and trial-dividing each one. The first candidate with no divisor becomes the witness prime.",
        "invariants": [
            "Every candidate is tested only by divisors whose square is at most the candidate.",
            "A candidate with no such divisor is prime.",
            "The witness always lies strictly between n and 2n."
        ],
        "correctness": "Trial division is a complete primality test: a composite number must have a factor at most its square root. Therefore the first divisor-free candidate found is genuinely prime. Finding it inside the open interval (n, 2n) directly verifies the postulate for that n.",
        "complexityRationale": "There are O(n) candidates and each is trial-divided by up to sqrt(2n) values, giving O(n sqrt(n)) time. No auxiliary arrays are needed, so space is O(1).",
        "uses": [
            "Verifying a classic existence theorem for small n",
            "Finding a prime in a prescribed interval",
            "Teaching the relationship between trial division and number theory proofs"
        ],
        "references": [
            "Erdos, Beweis eines Satzes von Tschebyschef (1932)",
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 2"
        ],
        "workedExample": "For n = 10 the candidates are 11 through 19. Testing 11 finds no divisor among 2 and 3, so 11 is prime and lies between 10 and 20. The postulate holds at n = 10 with witness 11."
    },
    id: "bertrand-postulate-check",
    name: "Bertrand Postulate Check",
    category: "math",
    complexity: { time: "O(n sqrt(n))", space: "O(1)" },
    defaultInput: { n: 10 },
    visualType: "grid",
    run,
    pseudocode: [
        "state the claim: some prime p has n < p < 2n",
        "list the candidates n+1..2n−1",
        "trial-divide each candidate by d = 2, 3, ...",
        "the first candidate with no divisor is the witness",
        "done: postulate holds at n with witness p",
    ],
};
export default module;
