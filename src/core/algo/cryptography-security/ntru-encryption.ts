/**
 * ntru-encryption.ts - NTRU Encryption (Toy Parameters)
 *
 * Implements the exact NTRU ring arithmetic with small parameters: multiply
 * polynomials modulo x^N-1, invert the private polynomial modulo p and q,
 * mask the message with a multiple of p, and recover it by reducing away the
 * mask. The small prime field makes inversion exact and checkable; these
 * parameters are not secure.
 *
 * Time:  O(N^3) for the linear-system inversions  Space: O(N^2)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NTRUInput {
    p?: number;
    q?: number;
    f?: number[];
    g?: number[];
    r?: number[];
    m?: number[];
}

/** Reduce an integer into the nonnegative residue range. */
function mod(a: number, m: number): number {
    return ((a % m) + m) % m;
}

/** Cyclic polynomial multiplication in Z_mod[x]/(x^N - 1). */
function multiply(a: number[], b: number[], modulus: number): number[] {
    const n = a.length;
    const result = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            result[(i + j) % n] = mod(result[(i + j) % n] + mod(a[i], modulus) * mod(b[j], modulus), modulus);
        }
    }
    return result;
}

/** Brute-force modular inverse of a nonzero residue in a small prime field. */
function inverse(value: number, modulus: number): number {
    const v = mod(value, modulus);
    for (let x = 1; x < modulus; x += 1) {
        if ((v * x) % modulus === 1) {
            return x;
        }
    }
    return 0;
}

/** Invert a polynomial by solving the circulant linear system A*g = e0. */
function polynomialInverse(f: number[], modulus: number): number[] | null {
    const n = f.length;
    const rows: number[][] = [];
    for (let k = 0; k < n; k += 1) {
        const row: number[] = [];
        for (let j = 0; j < n; j += 1) {
            row.push(mod(f[mod(k - j, n)], modulus));
        }
        for (let j = 0; j < n; j += 1) {
            row.push(j === k ? 1 : 0);
        }
        rows.push(row);
    }
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        while (pivot < n && rows[pivot][col] % modulus === 0) {
            pivot += 1;
        }
        if (pivot === n) {
            return null;
        }
        if (pivot !== col) {
            const tmp = rows[col];
            rows[col] = rows[pivot];
            rows[pivot] = tmp;
        }
        const scale = inverse(rows[col][col], modulus);
        for (let c = col; c < 2 * n; c += 1) {
            rows[col][c] = mod(rows[col][c] * scale, modulus);
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = rows[r][col];
            if (factor === 0) continue;
            for (let c = col; c < 2 * n; c += 1) {
                rows[r][c] = mod(rows[r][c] - factor * rows[col][c], modulus);
            }
        }
    }
    return rows.map((row) => row[n]);
}

/** Center each residue into the symmetric interval around zero. */
function center(coeffs: number[], modulus: number): number[] {
    const half = Math.floor(modulus / 2);
    return coeffs.map((value) => (value > half ? value - modulus : value));
}

/** Render one polynomial as a row of coefficient cells. */
function makeCells(values: number[], label: string): VisualEntity[] {
    return values.map((value, col) => ({
        id: `cell-0-${col}`,
        type: "cell",
        label: `${label}[${col}]=${value}`,
        value,
        state: (col === 0 ? "comparing" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NTRUInput | null) ?? {};
    const p = typeof task.p === "number" ? Math.trunc(task.p) : 3;
    const q = typeof task.q === "number" ? Math.trunc(task.q) : 97;
    const f = Array.isArray(task.f) ? [...task.f] : [1, 3, 3, 0, 0, 0, 0];
    const g = Array.isArray(task.g) ? [...task.g] : [1, -1, 1, 0, 0, 0, 0];
    const r = Array.isArray(task.r) ? [...task.r] : [0, 1, 0, -1, 0, 1, 0];
    const m = Array.isArray(task.m) ? [...task.m] : [1, 0, 1, 1, 0, 1, 0];
    const n = f.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(f, "f"),
        edges: [],
        description: `Toy NTRU in Z[x]/(x^${n}-1) with p=${p}, q=${q}; private polynomial f is chosen small.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: n, p, q, n, f, g, r, m },
    };
    step += 1;

    const Fp = polynomialInverse(f, p);
    const Fq = polynomialInverse(f, q);
    if (!Fp || !Fq) {
        yield {
            stepNumber: step,
            entities: makeCells(f, "f"),
            edges: [],
            description: "The private polynomial is not invertible in one of the rings; choose a different f.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: 1, cols: n, p, q, n, invertible: false, f, g, r, m },
        };
        return;
    }
    const Fqg = multiply(Fq, g, q);
    const hPublic = Fqg.map((value) => mod(value * p, q));

    yield {
        stepNumber: step,
        entities: makeCells(hPublic, "h"),
        edges: [],
        description: `Computed inverses Fp and Fq; public key h = p times Fq times g modulo q.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 1, cols: n, p, q, n, Fp, Fq, h: hPublic, invertible: true },
    };
    step += 1;

    const rh = multiply(r, hPublic, q);
    const e = rh.map((value, i) => mod(value + mod(m[i] ?? 0, q), q));
    yield {
        stepNumber: step,
        entities: makeCells(e, "e"),
        edges: [],
        description: `Encrypt with random r: ciphertext e = r*h + m modulo q.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: 1, cols: n, p, q, n, r, m, h: hPublic, e },
    };
    step += 1;

    const fa = multiply(f, e, q);
    const a = center(fa, q);
    const recovered = multiply(Fp, a.map((value) => mod(value, p)), p);
    const match = recovered.every((value, i) => value === mod(m[i] ?? 0, p));
    yield {
        stepNumber: step,
        entities: makeCells(recovered, "m"),
        edges: [],
        description: `Decrypt: a = f*e is centered, then Fp*a modulo p recovers ${recovered.join("")}${match ? " (matches)" : " (MISMATCH)"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 1, cols: n, p, q, n, a, recovered, m, match, h: hPublic, e },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "NTRU works in a ring of polynomials where exponents wrap around. The private key is a small polynomial f whose inverses exist modulo two different moduli p and q. The public key hides a small polynomial g inside a value that is a multiple of p, so encrypting adds a random multiple of that public value to the message and the receiver can strip it off by reducing modulo p.",
        invariants: [
            "The private polynomial f has inverses Fp modulo p and Fq modulo q.",
            "The public key h equals p times Fq times g modulo q.",
            "Every coefficient of f times the ciphertext is small enough to center without wraparound.",
        ],
        correctness:
            "Decryption computes f times e modulo q, which equals p times r times g plus f times m when no coefficient wraps. Reducing that centered polynomial modulo p kills the p times r times g mask and leaves f times m modulo p. Multiplying by Fp then gives f inverse times f times m, which is m. The test verifies the inverse identity directly and checks every binary message.",
        complexityRationale:
            "Polynomial multiplication is O(N^2) with schoolbook convolution, and inversion solves an N by N linear system in O(N^3). With tiny N this is constant in practice; real NTRU uses dedicated fast inversion.",
        uses: [
            "Post-quantum public-key encryption candidates",
            "Key encapsulation in lattice-based protocols",
            "A teaching model for arithmetic in polynomial rings",
        ],
        references: [
            "Hoffstein, Pipher and Silverman, NTRU: A Ring-Based Public Key Cryptosystem, 1998",
            "Hoffstein et al., NTRUEncrypt and NTRUSign, 2003",
        ],
        workedExample:
            "With N=7, p=3, q=97, f=1+3x+3x^2 and a small g, the public key is h=p*Fq*g mod 97. Encrypting the message bits [1,0,1,1,0,1,0] with a small random r gives e=r*h+m mod 97. The receiver centers f*e and reduces modulo 3 to recover exactly the original bits.",
    },
    id: "ntru-encryption",
    name: "NTRU Encryption (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(N^3)", space: "O(N^2)" },
    defaultInput: {
        p: 3,
        q: 97,
        f: [1, 3, 3, 0, 0, 0, 0],
        g: [1, -1, 1, 0, 0, 0, 0],
        r: [0, 1, 0, -1, 0, 1, 0],
        m: [1, 0, 1, 1, 0, 1, 0],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose small polynomials f and g and moduli p and q",
        "compute Fp as the inverse of f modulo p",
        "compute Fq as the inverse of f modulo q",
        "publish h = p times Fq times g modulo q",
        "encrypt with e = r times h plus the message modulo q",
        "decrypt by centering f times e",
        "multiply by Fp modulo p to remove the mask",
        "done: verify the recovered message equals the original",
    ],
};

export default module;
