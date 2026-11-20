/**
 * plonk-snark.ts - PLONK-Style Polynomial Identity Check (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A PLONK verifier reduces a circuit's correctness to a polynomial identity: a
 * constraint polynomial must vanish on the evaluation domain, equivalently it
 * must factor as a quotient times the domain vanishing polynomial. This module
 * implements exactly that algebraic core in the field modulo 97. It builds the
 * fourth-root-of-unity domain, forms Z(X) = X^4 - 1, constructs f(X) = h(X) Z(X)
 * from a witness polynomial h, and checks both that f vanishes on the domain
 * and that f(zeta) = h(zeta) Z(zeta) at a random-looking point. Corrupting a
 * coefficient makes both checks fail. This is a teaching model of the identity
 * check only: there are no polynomial commitments, no permutation argument, no
 * Fiat-Shamir transform, and no zero knowledge or production security.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(d) to evaluate and convolve polynomials of degree d
 *   Space: O(d) for the coefficient arrays
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the coefficient vectors of Z, h, and f.
 *   - The final frames show domain evaluations and the random-point check.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 97;

interface PlonkInput {
    h?: number[];
    zeta?: number;
    corrupt?: boolean;
}

function mod(value: number): number {
    return ((value % P) + P) % P;
}

function pow(base: number, exp: number): number {
    let result = 1;
    let b = mod(base);
    let e = exp;
    while (e > 0) {
        if (e & 1) {
            result = mod(result * b);
        }
        b = mod(b * b);
        e = Math.floor(e / 2);
    }
    return result;
}

/** Find a primitive fourth root of unity in the field. */
function omega(): number {
    for (let a = 2; a < P; a += 1) {
        if (pow(a, 4) === 1 && pow(a, 2) !== 1) {
            return a;
        }
    }
    return 1;
}

function evaluate(coeffs: number[], x: number): number {
    let result = 0;
    let power = 1;
    for (const coefficient of coeffs) {
        result = mod(result + coefficient * power);
        power = mod(power * x);
    }
    return result;
}

function multiply(a: number[], b: number[]): number[] {
    const result = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result[i + j] = mod((result[i + j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0));
        }
    }
    return result;
}

function coeffBars(z: number[], h: number[], f: number[], phase: number): VisualEntity[] {
    const groups: Array<{ name: string; coeffs: number[] }> = [
        { name: "Z", coeffs: z },
        { name: "h", coeffs: h },
        { name: "f", coeffs: f },
    ];
    const entities: VisualEntity[] = [];
    for (const group of groups) {
        for (let i = 0; i < group.coeffs.length; i += 1) {
            const state: EntityState = phase >= 3 ? (group.name === "f" ? "sorted" : "visited") : group.name === "f" ? "active" : "visited";
            entities.push({
                id: `bar-${group.name}-${i}`,
                type: "bar" as const,
                label: `${group.name}${i}=${group.coeffs[i]}`,
                value: group.coeffs[i] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: i, polynomial: group.name },
            });
        }
    }
    return entities;
}

/** Check the PLONK polynomial identity in a toy field. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PlonkInput | null) ?? {};
    const h: number[] = Array.isArray(task.h) && task.h.length > 0 ? task.h.map((c) => mod(Math.trunc(c))) : [2, 3, 1];
    const zeta = typeof task.zeta === "number" ? mod(Math.trunc(task.zeta)) : 11;
    const corrupt = task.corrupt === true;

    const w = omega();
    const domain = [1, w, pow(w, 2), pow(w, 3)];
    const zCoeffs = [mod(-1), 0, 0, 0, 1];
    const fCoeffs = multiply(h, zCoeffs);
    if (corrupt) {
        fCoeffs[0] = mod((fCoeffs[0] ?? 0) + 1);
    }
    const domainEvals = domain.map((x) => evaluate(fCoeffs, x));
    const vanishes = domainEvals.every((value) => value === 0);
    const left = evaluate(fCoeffs, zeta);
    const right = mod(evaluate(h, zeta) * evaluate(zCoeffs, zeta));
    const pointMatches = left === right;
    const accept = vanishes && pointMatches;

    const baseMeta = {
        p: P,
        omega: w,
        domain,
        zCoeffs,
        hCoeffs: h,
        fCoeffs: fCoeffs.slice(),
        domainEvals,
        zeta,
        vanishes: false,
        left: 0,
        right: 0,
        pointMatches: false,
        accept: false,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, [], 0),
        edges: [],
        description: `PLONK-style identity check in the field modulo ${P} over the 4-point domain.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...baseMeta, fCoeffs: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, [], 0),
        edges: [],
        description: `Domain is the fourth roots of unity ${domain.join(", ")}; its vanishing polynomial is Z(X) = X^4 - 1.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...baseMeta, fCoeffs: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, fCoeffs, 1),
        edges: [],
        description: `Form f(X) = h(X) Z(X) as a coefficient convolution modulo ${P}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...baseMeta, domainEvals: [] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, fCoeffs, 3),
        edges: [],
        description: `Evaluate f on the domain: ${domainEvals.join(", ")}; all must be zero for the identity to hold.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { ...baseMeta, vanishes, pointMatches: false, accept: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, fCoeffs, 3),
        edges: [],
        description: `At zeta = ${zeta}, f(zeta) = ${left} and h(zeta)Z(zeta) = ${right}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...baseMeta, vanishes, left, right, pointMatches, accept: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: coeffBars(zCoeffs, h, fCoeffs, 3),
        edges: [],
        description: accept
            ? `Accepted: f vanishes on the domain and the identity holds at zeta.`
            : `Rejected: the polynomial identity fails on the domain or at zeta.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...baseMeta, vanishes, left, right, pointMatches, accept },
    };
}

/** The toy PLONK identity module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A PLONK proof says a big constraint polynomial is divisible by a fixed vanishing polynomial. Instead of checking every coefficient, the verifier samples a random point and checks the identity there, which is enough unless the polynomials differ. The teaching core is simple: build the vanishing polynomial of the domain, multiply it by a quotient to get the constraint polynomial, confirm it is zero at every domain point, and confirm the product identity at a random point.",
        invariants: [
            "The domain points are the fourth roots of unity, so Z(X) = X^4 - 1 vanishes on all of them.",
            "The constraint polynomial f is the coefficient-wise convolution of h and Z modulo the field prime.",
            "The identity f = h Z holding as polynomials implies equality at every evaluation point.",
        ],
        correctness:
            "If f is constructed as h times Z then f(x) = h(x) Z(x) for every field element x, so f is zero on the domain where Z is zero and the random-point equality holds exactly. Conversely, if a coefficient of f is corrupted, f minus h Z is a nonzero polynomial of degree at most six, which cannot vanish at all four domain points and almost surely fails at a random zeta. Checking both conditions therefore accepts valid identities and rejects corrupted ones in this toy field.",
        complexityRationale:
            "Convolving polynomials of degree d takes O(d squared) scalar products and evaluating them at a point takes O(d); with a constant-size toy domain the work is small and constant. Memory is O(d) for the three coefficient arrays.",
        uses: [
            "Understanding the algebra behind universal SNARK verifiers",
            "Teaching vanishing polynomials and Schwartz-Zippel style checks",
            "Comparing PLONK with Groth16 and STARK proof structures",
        ],
        references: [
            "Gabizon, Williamson and Ciobotaru, PLONK: Permutations over Lagrange-bases, 2019",
            "Ben-Sasson et al., Fast Reed-Solomon Interactive Oracle Proofs, 2018",
        ],
        workedExample:
            "In the field modulo 97 the fourth roots of unity are 1, 22, 96 and 75, and Z(X) = X^4 - 1. With h(X) = 2 + 3X + X^2 the product is f(X) = 95 + 94X + 96X^2 + 2X^3 + 3X^4 + X^5. Evaluating f at each domain point gives zero, and at zeta = 11 both f(zeta) and h(zeta)Z(zeta) equal 72, so the identity is accepted; adding one to a coefficient breaks both checks.",
    },
    id: "plonk-snark",
    name: "PLONK SNARK (Toy Identity Check)",
    category: "cryptography-security",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: { h: [2, 3, 1], zeta: 11 },
    visualType: "array",
    run,
    pseudocode: [
        "fix a prime field and a four-point evaluation domain",
        "build the vanishing polynomial Z(X) = X^4 - 1",
        "read the quotient polynomial h and form f = h * Z",
        "evaluate f at every domain point and require zero",
        "choose a random-looking point zeta in the field",
        "check f(zeta) equals h(zeta) * Z(zeta)",
        "accept only when both checks pass",
    ],
};

export default module;
