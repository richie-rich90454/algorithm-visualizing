/**
 * related-message-attack.ts - Franklin-Reiter Related-Message Attack
 *
 * When the same RSA modulus encrypts two messages linked by a known affine
 * relation m2 = a*m + b, the plaintext can be recovered without factoring the
 * modulus. Form the polynomials x^e - c1 and (a*x + b)^e - c2 over Z_n; their
 * greatest common divisor is the linear factor x - m. Polynomial Euclid over a
 * prime field reveals m directly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Poly = bigint[];

function trim(p: Poly): Poly {
    const out = [...p];
    while (out.length > 1 && out[out.length - 1] === 0n) out.pop();
    return out;
}

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % mod;
        b = (b * b) % mod;
        e /= 2n;
    }
    return result;
}

function invMod(a: bigint, mod: bigint): bigint {
    return powMod(((a % mod) + mod) % mod, mod - 2n, mod);
}

function sub(a: Poly, b: Poly, mod: bigint): Poly {
    const len = Math.max(a.length, b.length);
    const out: Poly = [];
    for (let i = 0; i < len; i += 1) {
        const x = a[i] ?? 0n;
        const y = b[i] ?? 0n;
        out.push(((x - y) % mod + mod) % mod);
    }
    return trim(out);
}

function mul(a: Poly, b: Poly, mod: bigint): Poly {
    const out = new Array<bigint>(a.length + b.length - 1).fill(0n);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i + j] = (out[i + j]! + a[i]! * b[j]!) % mod;
        }
    }
    return trim(out);
}

function remainder(a: Poly, b: Poly, mod: bigint): Poly {
    let rest = trim(a);
    const divisor = trim(b);
    const invLead = invMod(divisor[divisor.length - 1]!, mod);
    while (rest.length >= divisor.length && !(rest.length === 1 && rest[0] === 0n)) {
        const factor = (rest[rest.length - 1]! * invLead) % mod;
        if (factor === 0n) break;
        const shifted = new Array<bigint>(rest.length).fill(0n);
        for (let j = 0; j < divisor.length; j += 1) {
            shifted[rest.length - divisor.length + j] = (divisor[j]! * factor) % mod;
        }
        rest = trim(sub(rest, shifted, mod));
    }
    return rest;
}

function gcdPoly(a: Poly, b: Poly, mod: bigint, trace: string[]): Poly {
    let x = trim(a);
    let y = trim(b);
    let guard = 0;
    while (!(y.length === 1 && y[0] === 0n) && guard < 40) {
        guard += 1;
        const r = remainder(x, y, mod);
        trace.push(`degrees ${x.length - 1} and ${y.length - 1} reduce to degree ${r.length - 1}`);
        x = y;
        y = r;
    }
    return x;
}

function makeCells(cells: Array<[string, string]>, highlight: number): VisualEntity[] {
    return cells.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value ? `${label}: ${value}` : label,
        value,
        state: (index === highlight ? "active" : value ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 2), col: index % 2, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; e?: number; a?: number; b?: number; message?: number } | null) ?? {};
    const n = BigInt(Math.max(3, Math.floor(task.n ?? 1000003)));
    const e = Math.max(2, Math.floor(task.e ?? 3));
    const a = BigInt(task.a ?? 2);
    const b = BigInt(task.b ?? 3);
    const m = BigInt(Math.max(1, Math.floor(task.message ?? 1234)));
    const frames: VisualFrame[] = [];
    const c1 = powMod(m, BigInt(e), n);
    const c2 = powMod(a * m + b, BigInt(e), n);

    const push = (cells: Array<[string, string]>, desc: string, line: number, highlight = -1, recovered = 0): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(cells, highlight),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                n: n.toString(),
                e,
                a: a.toString(),
                b: b.toString(),
                c1: c1.toString(),
                c2: c2.toString(),
                recovered: String(recovered),
                message: m.toString(),
            },
        });
    };

    push([
        ["modulus", n.toString()],
        ["exponent", String(e)],
        ["c1", c1.toString()],
        ["c2", c2.toString()],
    ], `Related messages under modulus ${n} with exponent ${e}.`, 0);

    const base: Poly = [b, a];
    let aPow: Poly = [1n];
    for (let k = 0; k < e; k += 1) aPow = mul(aPow, base, n);
    const f = trim(sub([...aPow], [c2], n));
    const g: Poly = new Array<bigint>(e + 1).fill(0n);
    g[e] = 1n;
    const gTerm = trim(sub(g, [c1], n));

    push([["f degree", String(f.length - 1)], ["g degree", String(gTerm.length - 1)], ["relation", `${a}x+${b}`], ["field", "mod n"]], "Built x^e-c1 and (ax+b)^e-c2 over the modulus.", 2);

    const trace: string[] = [];
    const common = gcdPoly(f, gTerm, n, trace);
    for (const step of trace.slice(0, 6)) {
        push([["euclid step", step], ["degree", String(common.length - 1)], ["target", "linear factor"], ["field", "mod n"]], step, 3);
    }

    let recovered = -1n;
    if (common.length === 2 && common[1] === 1n) {
        recovered = ((-common[0]!) % n + n) % n;
    } else if (common.length === 2) {
        recovered = ((-common[0]! * invMod(common[1]!, n)) % n + n) % n;
    }
    push(
        [["gcd degree", String(common.length - 1)], ["recovered", recovered.toString()], ["original", m.toString()], ["verified", recovered === m ? "yes" : "no"]],
        `Recovered m = ${recovered} from the linear gcd factor.`,
        4,
        1,
        recovered < 0n ? 0 : Number(recovered),
    );

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeCells(
            [["gcd degree", String(common.length - 1)], ["recovered", recovered.toString()], ["original", m.toString()], ["verified", recovered === m ? "yes" : "no"]],
            3,
        ),
        edges: [],
        description: `Done: ${recovered === m ? "recovered the related message" : "could not recover the message"}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            n: n.toString(),
            e,
            a: a.toString(),
            b: b.toString(),
            c1: c1.toString(),
            c2: c2.toString(),
            recovered: recovered < 0n ? "-1" : recovered.toString(),
            message: m.toString(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two ciphertexts of messages that differ by a known offset share a hidden root. Treat each ciphertext as a polynomial equation in the unknown message; the message they share is a common root. Computing the polynomial greatest common divisor cancels every other root and leaves a linear equation that gives the message away.",
        invariants: [
            "Both polynomials vanish at the unknown message modulo n.",
            "Polynomial Euclid preserves the gcd of the pair at every step.",
            "A linear gcd has the form x - m, so its constant term is -m.",
        ],
        correctness:
            "The polynomials x^e-c1 and (a*x+b)^e-c2 have the true message as a common root, so x-m divides their gcd. With a prime modulus and a small exponent the gcd is exactly linear, and its root is recovered by dividing minus the constant term by the leading coefficient. This equals the original message because that root is unique.",
        complexityRationale:
            "Polynomial multiplication of degree e costs O(e^2) field operations and Euclid performs O(e) reductions, so the attack is polynomial in the exponent and tiny for teaching parameters.",
        uses: [
            "Demonstrating why RSA must use randomized padding",
            "Cryptanalysis of systems that reuse a modulus with related messages",
            "Teaching polynomial gcd over finite fields",
        ],
        references: [
            "Franklin and Reiter, A Linear Protocol Failure for RSA with Exponent Three, 1995",
            "Menezes, Oorschot and Vanstone, Handbook of Applied Cryptography, chapter on public-key attacks",
        ],
        workedExample:
            "With n = 1000003, e = 3, a = 2, b = 3 and m = 1234, compute c1 = m^3 mod n and c2 = (2m+3)^3 mod n. The gcd of x^3-c1 and (2x+3)^3-c2 is x-1234, revealing the message without factoring n.",
    },
    id: "related-message-attack",
    name: "Related-Message Attack (Franklin-Reiter)",
    category: "math",
    complexity: { time: "O(e^3)", space: "O(e)" },
    defaultInput: { n: 1000003, e: 3, a: 2, b: 3, message: 1234 },
    visualType: "grid",
    run,
    pseudocode: [
        "read modulus, exponent, affine relation and ciphertexts",
        "form f(x) = x^e - c1 over the field modulo n",
        "form g(x) = (a*x + b)^e - c2 over the same field",
        "run the polynomial Euclidean algorithm until a linear gcd remains",
        "read the message from the root of that linear factor",
        "verify the recovered message against the first ciphertext",
        "done: report the recovered message",
    ],
};

export default module;
