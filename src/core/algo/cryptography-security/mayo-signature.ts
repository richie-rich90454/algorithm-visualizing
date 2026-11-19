/**
 * mayo-signature.ts - MAYO-Style Oil-Vinegar Signature (Toy Field Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MAYO builds signatures from an oil-vinegar map whose oil variables span a
 * subspace on which the public quadratic forms vanish. Fixing the vinegar
 * variables makes each quadratic form linear in the oil variables, so a signer
 * can solve a small linear system for oil values that hit a message digest.
 * Anyone can recompute the forms on the signature and compare with the digest,
 * but deriving the oil subspace from the public forms is the hard problem. This
 * module implements that teachable core over the field with 31 elements, with
 * two vinegar equations and two oil variables. It is a small teaching model,
 * not the MAYO specification and not a production signature scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^2) per form evaluation, O(k^3) for the oil solve
 *   Space: O(m * n^2) for the public forms
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the message target, the vinegar values, and the solved oil values.
 *   - meta carries the signature and whether verification passed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const P = 31;
const N = 6;
const VINEGAR = 4;
const OIL = 2;
const FORMS = 2;

const mod = (value: number): number => ((value % P) + P) % P;

/** Exact modular exponentiation by repeated squaring. */
function powMod(base: number, exponent: number): number {
    let result = 1;
    let b = mod(base);
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = mod(result * b);
        }
        b = mod(b * b);
        e = Math.floor(e / 2);
    }
    return result;
}

/** Deterministic linear-congruential source for the public forms. */
function next(seed: { value: number }): number {
    seed.value = (Math.imul(seed.value, 1103515245) + 12345) >>> 0;
    return (seed.value >>> 8) % P;
}

/** Build m symmetric forms whose oil-oil block is zero. */
export function buildForms(): number[][][] {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const seed = { value: 1234 + attempt * 7919 };
        const forms: number[][][] = [];
        for (let r = 0; r < FORMS; r += 1) {
            const matrix = Array.from({ length: N }, () => new Array<number>(N).fill(0));
            for (let i = 0; i < VINEGAR; i += 1) {
                for (let j = i; j < N; j += 1) {
                    const value = next(seed);
                    matrix[i]![j] = value;
                    matrix[j]![i] = value;
                }
            }
            forms.push(matrix);
        }
        const a = forms[0]![VINEGAR]![0]!;
        const b = forms[0]![VINEGAR]![1]!;
        const c = forms[1]![VINEGAR]![0]!;
        const d = forms[1]![VINEGAR]![1]!;
        if (mod(a * d - b * c) !== 0) {
            return forms;
        }
    }
    throw new Error("could not build invertible oil-vinegar forms");
}

const FORMS_KEY = buildForms();

/** Evaluate a quadratic form on a full vector. */
export function evaluate(form: number[][], x: number[]): number {
    let sum = 0;
    for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < N; j += 1) {
            sum += (form[i]![j] ?? 0) * (x[i] ?? 0) * (x[j] ?? 0);
        }
    }
    return mod(sum);
}

/** Hash a message into two target field elements. */
export function messageTarget(message: string): [number, number] {
    let h0 = 2166136261;
    let h1 = 1013904223;
    for (let i = 0; i < message.length; i += 1) {
        h0 = Math.imul(h0 ^ message.charCodeAt(i), 16777619) >>> 0;
        h1 = Math.imul(h1 + message.charCodeAt(i) + i, 2246822519) >>> 0;
    }
    return [mod(h0), mod(h1 + 1)];
}

/** Choose vinegar values deterministically from the message and a nonce. */
function vinegarFor(message: string, nonce: number): number[] {
    return Array.from({ length: VINEGAR }, (_, index) => {
        let h = Math.imul(nonce + 1, 0x9e3779b9) ^ (message.charCodeAt(index % Math.max(1, message.length)) || 17);
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        return mod(h + index);
    });
}

/** Solve the two-by-two oil system for a message and nonce. */
export function sign(message: string, nonce: number): number[] {
    const target = messageTarget(message);
    let chosenNonce = nonce;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const vinegar = vinegarFor(message, chosenNonce);
        const coefficients: number[][] = [];
        const constants: number[] = [];
        for (let r = 0; r < FORMS; r += 1) {
            const form = FORMS_KEY[r]!;
            constants.push(evaluate(form, vinegar.concat([0, 0])));
            coefficients.push(
                Array.from({ length: OIL }, (_, oilIndex) => {
                    let sum = 0;
                    for (let j = 0; j < VINEGAR; j += 1) {
                        sum += 2 * (form[VINEGAR + oilIndex]![j] ?? 0) * (vinegar[j] ?? 0);
                    }
                    return mod(sum);
                }),
            );
        }
        const a = coefficients[0]![0]!;
        const b = coefficients[0]![1]!;
        const c = coefficients[1]![0]!;
        const d = coefficients[1]![1]!;
        const det = mod(a * d - b * c);
        if (det === 0) {
            chosenNonce += 1;
            continue;
        }
        const inverse = powMod(det, P - 2);
        const rhs0 = mod(target[0] - constants[0]!);
        const rhs1 = mod(target[1] - constants[1]!);
        const o0 = mod(inverse * (d * rhs0 - b * rhs1));
        const o1 = mod(inverse * (a * rhs1 - c * rhs0));
        return vinegar.concat([o0, o1]);
    }
    throw new Error("could not find invertible vinegar values");
}

/** Verify a signature against the message target. */
export function verify(message: string, signature: number[]): boolean {
    if (signature.length !== N || signature.some((v) => v < 0 || v >= P)) {
        return false;
    }
    const target = messageTarget(message);
    return FORMS_KEY.every((form, index) => evaluate(form, signature) === target[index]);
}

function makeBars(values: number[], active: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `val-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === active ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index < VINEGAR ? "vinegar" : "oil" },
    }));
}

/** The MAYO-style generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: string; nonce?: number } | null) ?? {};
    const message = String(task.message ?? "hello");
    const nonce = typeof task.nonce === "number" ? Math.floor(task.nonce) : 1;
    const target = messageTarget(message);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars([target[0], target[1], 0, 0, 0, 0], 0),
        edges: [],
        description: `Oil-vinegar signature: hash the message to targets ${target[0]}, ${target[1]} in the field of size 31.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { message, nonce, target, verified: false, signature: "" },
    };
    step += 1;

    const signature = sign(message, nonce);
    const vinegar = signature.slice(0, VINEGAR);
    yield {
        stepNumber: step,
        entities: makeBars([...vinegar, 0, 0], 2),
        edges: [],
        description: `Choose vinegar values ${vinegar.join(", ")} from the message and nonce.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { message, nonce, target, vinegar, verified: false, signature: "" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(signature, 4),
        edges: [],
        description: `With vinegar fixed, solve the linear system for oil values ${signature[VINEGAR]}, ${signature[VINEGAR + 1]}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { message, nonce, target, signature: signature.join(","), verified: false },
    };
    step += 1;

    const ok = verify(message, signature);
    yield {
        stepNumber: step,
        entities: makeBars([evaluate(FORMS_KEY[0]!, signature), evaluate(FORMS_KEY[1]!, signature), ...signature.slice(2)], 0),
        edges: [],
        description: `Recompute both public forms: ${ok ? "they match the target, signature verifies" : "mismatch"}. Toy parameters only.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { message, nonce, target, signature: signature.join(","), verified: ok },
    };
}

/** The MAYO-style module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An oil-vinegar scheme hides a secret subspace inside public quadratic equations. Values in the oil subspace make the quadratic terms vanish, so once a signer fixes the remaining vinegar variables, the equations become linear in the oil variables. The signer solves that small system to hit a hash of the message. A verifier only needs the public equations, but recovering the hidden subspace from them is designed to be hard.",
        invariants: [
            "Each public form has a zero oil-oil block, so it is linear in oil variables once vinegar is fixed.",
            "The two-by-two oil coefficient matrix is invertible, guaranteeing a unique oil solution.",
            "Verification recomputes both public forms and compares them with the message target.",
        ],
        correctness:
            "For every tested message and nonce the solver produces a signature whose two public-form evaluations equal the message hash, and changing any signature coordinate makes verification fail. An exhaustive search over all oil pairs confirms the linear solve finds the same solution that direct evaluation requires. These checks verify the toy oil-vinegar algebra, not the security or parameters of the real MAYO scheme.",
        complexityRationale:
            "Evaluating one quadratic form inspects every pair of the n variables, costing O(n^2); signing adds an O(k^3) solve for k oil variables. Public keys hold m by n by n field elements, so space is O(m n^2).",
        uses: [
            "Post-quantum signatures based on multivariate quadratic problems",
            "Teaching how hiding a linear subspace shortens signature keys",
            "Comparing oil-vinegar designs with lattice and hash signatures",
        ],
        references: [
            "Patarin, The Oil and Vinegar Signature Scheme, 1997",
            "Beullens et al., MAYO: Practical Post-Quantum Signatures from Oil-Vinegar Maps, 2022",
        ],
        workedExample:
            "For message hello the hash gives targets t1 and t2 in the field of size 31. The signer picks four vinegar values, evaluates both forms at those values to get constants, solves the two-by-two system for the two oil values, and publishes all six field elements. Verification evaluates both public forms on the six elements and checks equality with t1 and t2.",
    },
    id: "mayo-signature",
    name: "MAYO-Style Oil-Vinegar Signature (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(n^2 + k^3)", space: "O(m n^2)" },
    defaultInput: { message: "hello", nonce: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "hash the message into two field elements as the target",
        "choose vinegar values from the message and a nonce",
        "evaluate the public forms at the vinegar values to get constants",
        "form the two-by-two coefficient matrix in the oil variables",
        "invert the matrix and solve for the oil values",
        "publish the vinegar and oil values as the signature",
        "verify by evaluating both forms and comparing with the target",
        "done: report whether the signature verifies",
    ],
};

export default module;
