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
 * wilson-theorem-prime-test – Wilson Primality Check.
 * p prime iff (p-1)! = -1 mod p; builds the factorial live.
 * Default p=7: 720 mod 7 = 6 = -1, prime. Time O(p).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { p?: number } | null) ?? {};
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 7;
    let step = 0;
    if (!(p >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs p >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `p=${p}`, p, "idle")],
        edges: [],
        description: `Wilson: p=${p} prime iff ${p - 1}! = ${p - 1} mod ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let f = 1;
    for (let k = 1; k <= p - 1; k += 1) {
        f = (f * k) % p;
        if (k <= 3 || k === p - 1) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `${k}!=${f}`, f, k === p - 1 ? "highlight" : "comparing")],
                edges: [],
                description: `${k}! mod ${p} = ${f}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { k, f },
            };
            step += 1;
        }
    }
    const prime = f === p - 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${f}`, f, prime ? "sorted" : "swapped")],
        edges: [],
        description: prime
            ? `${p - 1}! = ${f} = -1 mod ${p} – PRIME.`
            : `${p - 1}! = ${f} != -1 mod ${p} – composite.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { prime },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Wilson's theorem states that a number p is prime if and only if (p-1)! is congruent to -1 modulo p. The visualization accumulates the factorial modulo p one factor at a time, wrapping after each multiplication to keep numbers small. The final residue decides primality exactly, making this a correct but impractical test.",
        "invariants": [
            "After k steps the running value equals k! modulo p.",
            "For a prime p the factorial (p-1)! is never zero modulo p.",
            "The final residue is p-1 exactly when p is prime."
        ],
        "correctness": "For a prime p, every nonzero residue pairs with its inverse, and only 1 and p-1 are their own inverses, so the product of all residues is -1 mod p, giving Wilson's theorem. For composite p greater than 4 the factorial contains factors forcing zero mod p. Therefore checking the residue exactly decides primality.",
        "complexityRationale": "Multiplying p-1 factors costs O(p) modular operations, which is hopeless for large p but fine as a teaching demonstration. Only the running residue is stored, so space is O(1).",
        "uses": [
            "A theoretically exact primality characterization",
            "Teaching factorials modulo a prime and Wilson's theorem",
            "Checking small primes in number theory exercises"
        ],
        "references": [
            "Wilson, Meditationes algebraicae (1770)",
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 3"
        ],
        "workedExample": "For p = 7 compute 6! = 720 and 720 mod 7 = 6 = -1 mod 7. The residue is p-1, so 7 is prime. For a composite such as 8, 7! is divisible by 8 and the residue is 0."
    },
    id: "wilson-theorem-prime-test",
    name: "Wilson Theorem Prime Test",
    category: "math",
    complexity: { time: "O(p)", space: "O(1)" },
    defaultInput: { p: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "state Wilson: prime iff (p−1)! ≡ −1 mod p",
        "accumulate k! mod p step by step",
        "done: −1 means PRIME, else composite",
        "factorials wrap modulo p each round",
        "done: factorial residue decides primality",
    ],
};
export default module;
