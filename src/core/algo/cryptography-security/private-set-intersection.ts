/**
 * private-set-intersection.ts - Polynomial-Evaluation Private Set Intersection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Private set intersection lets two parties learn the common elements of their
 * sets without revealing the rest. In the polynomial approach, one party builds
 * a polynomial whose roots are exactly its elements. For each element of the
 * other party, an oblivious evaluation returns that polynomial at the element;
 * a zero result means the element is in the first set. Because the evaluation is
 * oblivious, the first party never learns which elements were tested. This
 * module builds the root polynomial and performs the membership tests with a
 * simulated oblivious evaluation, over a small prime field. It is a teaching
 * model, not a production PSI protocol.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(|Y|^2 + |X| * |Y|) field operations
 *   Space: O(|Y|) for the polynomial coefficients
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show polynomial coefficients and each tested element's evaluation.
 *   - meta reports the two sets, the evaluations, and the intersection.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 101;
const mod = (value: number): number => ((value % P) + P) % P;

/** Build coefficients of the monic polynomial with the given roots. */
export function rootPolynomial(roots: number[]): number[] {
    let coefficients = [1];
    for (const root of roots) {
        const next = new Array<number>(coefficients.length + 1).fill(0);
        for (let i = 0; i < coefficients.length; i += 1) {
            const value = coefficients[i] ?? 0;
            next[i] = mod((next[i] ?? 0) - value * root);
            next[i + 1] = mod((next[i + 1] ?? 0) + value);
        }
        coefficients = next;
    }
    return coefficients;
}

/** Evaluate a polynomial at a point with Horner's rule. */
export function evaluatePolynomial(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
        result = mod(result * x + (coefficients[i] ?? 0));
    }
    return result;
}

/** Simulated oblivious evaluation: a zero result certifies membership. */
export function psi(client: number[], server: number[]): number[] {
    const polynomial = rootPolynomial(server);
    return client.filter((element) => evaluatePolynomial(polynomial, element) === 0);
}

const parseSet = (raw: unknown, fallback: number[]): number[] => {
    if (Array.isArray(raw)) {
        return raw.map((v) => mod(Math.floor(Number(v)))).filter((v) => Number.isFinite(v));
    }
    if (typeof raw === "string") {
        return raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)).map(mod);
    }
    return fallback;
};

function makeBars(values: number[], active: number): VisualEntity[] {
    const list = values.length > 0 ? values : [0];
    return list.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: "coefficient/evaluation" },
    }));
}

/** The PSI generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { client?: unknown; server?: unknown } | null) ?? {};
    const client = parseSet(task.client, [3, 7, 12, 19]);
    const server = parseSet(task.server, [2, 7, 12, 25]);
    const polynomial = rootPolynomial(server);
    const result = psi(client, server);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(polynomial.slice(0, 8), 0),
        edges: [],
        description: `Private set intersection: build a polynomial whose roots are the server's ${server.length} element(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { client: client.join(","), server: server.join(","), intersection: "", tested: "" },
    };
    step += 1;

    const evaluations = client.map((element) => ({ element, value: evaluatePolynomial(polynomial, element) }));
    yield {
        stepNumber: step,
        entities: makeBars(evaluations.map((e) => e.value).slice(0, 8), 0),
        edges: [],
        description: `Obliviously evaluate the polynomial at each client element; zero means membership.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { client: client.join(","), server: server.join(","), intersection: "", tested: evaluations.map((e) => `${e.element}:${e.value}`).join(",") },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(result.slice(0, 8), 0),
        edges: [],
        description: `Intersection is ${result.length === 0 ? "empty" : result.join(", ")}; non-members were never revealed. Simulated OT, toy field.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { client: client.join(","), server: server.join(","), intersection: result.join(","), tested: evaluations.map((e) => `${e.element}:${e.value}`).join(","), size: result.length },
    };
}

/** The PSI module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Private set intersection answers which items two sets share without disclosing the items that are not shared. One party encodes its whole set as the roots of a polynomial. The other party evaluates that polynomial at each of its own items; a zero result means the item is a root and therefore in the other set. If the evaluation is done obliviously, the first party never sees which items were tested, so only the common elements leak.",
        invariants: [
            "The server polynomial evaluates to zero exactly on its own set within the field.",
            "A client element enters the intersection if and only if its evaluation is zero.",
            "The client's non-matching elements are never sent to the server in the real protocol.",
        ],
        correctness:
            "For every tested pair of small sets the intersection returned by polynomial evaluation equals the intersection computed directly with set membership, and an exhaustive scan of the field confirms the polynomial vanishes on every server element and nowhere else. Duplicate and empty sets are handled. The oblivious evaluation is simulated here, so the check verifies the polynomial membership algebra, not the privacy of a real PSI construction.",
        complexityRationale:
            "Multiplying in one root at a time costs O(|Y|^2) to build the polynomial, and each of the |X| evaluations uses Horner's rule in O(|Y|), giving O(|Y|^2 + |X||Y|) time and O(|Y|) space.",
        uses: [
            "Finding common contacts or customers without exposing full lists",
            "Privacy-preserving fraud and duplicate-account detection",
            "Private join keys in data collaboration",
        ],
        references: [
            "Freedman, Nissim, and Pinkas, Efficient Private Matching and Set Intersection, 2004",
            "Pinkas, Schneider, Seo, and Tkachenko, Efficient Circuit-Based PSI with Linear Communication, 2019",
        ],
        workedExample:
            "For server set 7 and 12 the polynomial is (z minus 7)(z minus 12) expanded modulo 101. Evaluating at client element 7 gives zero, so 7 is in the intersection; evaluating at 3 gives a nonzero residue, so 3 is not. The server never learns which client element produced each evaluation.",
    },
    id: "private-set-intersection",
    name: "Private Set Intersection via Polynomial Evaluation",
    category: "cryptography-security",
    complexity: { time: "O(|Y|^2 + |X||Y|)", space: "O(|Y|)" },
    defaultInput: { client: [3, 7, 12, 19], server: [2, 7, 12, 25] },
    visualType: "array",
    run,
    pseudocode: [
        "receive the server set and build a polynomial with those roots",
        "for each client element evaluate the polynomial obliviously",
        "mark the element as common when the evaluation is zero",
        "collect all marked elements into the intersection",
        "report only the common elements to both parties",
        "done: reveal the intersection and nothing else",
    ],
};

export default module;
