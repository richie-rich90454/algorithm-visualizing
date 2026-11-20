/**
 * bgw-protocol.ts - BGW SecureMulti-Party Computation (Toy Parameters)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * BGW lets several parties compute a function of their private inputs without
 * revealing those inputs. Each secret is split into Shamir shares: points on a
 * random polynomial whose constant term is the secret. Addition is done share
 * by share; multiplication multiplies shares locally, which raises the degree,
 * and a degree-reduction step restores a valid sharing. With n=3 and t=1, any
 * single share is independent of the secret, while all three reconstruct it.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) Lagrange interpolation for each reconstruction
 *   Space: O(n) shares per secret
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows the three shares of the first secret, row one the second.
 *   - Row two shows the computed sum and product shares at each party.
 *   - meta carries the reconstructed sum and product plus the share arrays.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BgwInput {
    a?: number;
    b?: number;
    p?: number;
    parties?: number;
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

/** Evaluate a polynomial given by low-to-high coefficients at x. */
function evaluate(coefficients: number[], x: number, p: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i -= 1) result = (result * x + (coefficients[i] as number)) % p;
    return result;
}

/** Shamir-share a secret with degree t and deterministic coefficients. */
function share(secret: number, p: number, parties: number, t: number, salt: number): number[] {
    const coefficients = [secret];
    for (let i = 1; i <= t; i += 1) coefficients.push((salt * (7 * i + 3) + i * 5) % p);
    return Array.from({ length: parties }, (_, index) => evaluate(coefficients, index + 1, p));
}

/** Modular exponentiation by repeated squaring, used for field inverses. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Lagrange interpolation at x=0 from a set of (x, y) share points. */
function reconstruct(points: number[], p: number): number {
    const n = points.length;
    let result = 0;
    for (let i = 0; i < n; i += 1) {
        let term = points[i] as number;
        for (let j = 0; j < n; j += 1) {
            if (i === j) continue;
            const xi = i + 1;
            const xj = j + 1;
            const inverse = modPow((xi - xj + p) % p, p - 2, p);
            term = (term * ((p - xj) % p) * inverse) % p;
        }
        result = (result + term) % p;
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BgwInput | null) ?? {};
    const p = Math.max(5, Math.floor(task.p ?? 23));
    const a = ((Math.floor(task.a ?? 7) % p) + p) % p;
    const b = ((Math.floor(task.b ?? 4) % p) + p) % p;
    const parties = Math.max(3, Math.floor(task.parties ?? 3));
    const t = 1;
    let step = 0;
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 3, cols: parties, p, parties, t, ...meta },
    });

    yield emit([], `BGW with ${parties} parties, threshold t=${t}, modulus ${p}; the two secrets stay hidden.`, 0, {
        stage: "setup",
        a,
        b,
        note: "secrets are shown only in meta for verification",
    });

    const sharesA = share(a, p, parties, t, 1);
    const sharesB = share(b, p, parties, t, 2);
    for (let i = 0; i < parties; i += 1) {
        yield emit(
            [cell(`a-${i}`, 0, i, String(sharesA[i]), sharesA[i] as number, "active"), cell(`b-${i}`, 1, i, String(sharesB[i]), sharesB[i] as number, "active")],
            `Party ${i + 1} receives share ${sharesA[i]} of a and share ${sharesB[i]} of b.`,
            1,
            { stage: "share", party: i + 1, sharesA: [...sharesA], sharesB: [...sharesB] },
        );
    }

    const sumShares = sharesA.map((value, i) => ((value + (sharesB[i] as number)) % p));
    for (let i = 0; i < parties; i += 1) {
        yield emit(
            [cell(`sum-${i}`, 2, i, String(sumShares[i]), sumShares[i] as number, "sorted")],
            `Party ${i + 1} adds its shares locally: ${sharesA[i]} + ${sharesB[i]} = ${sumShares[i]} mod ${p}.`,
            2,
            { stage: "sum", party: i + 1, sumShares: [...sumShares] },
        );
    }
    const sum = reconstruct(sumShares, p);
    const productShares = sharesA.map((value, i) => ((value * (sharesB[i] as number)) % p));
    const product = reconstruct(productShares, p);
    yield emit(
        sumShares.map((value, i) => cell(`ss-${i}`, 2, i, String(value), value, "sorted")),
        `Reconstructing the sum from ${parties} points gives ${sum} = (${a} + ${b}) mod ${p}.`,
        3,
        { stage: "sum-done", sum, productShares: [...productShares] },
    );

    for (let i = 0; i < parties; i += 1) {
        yield emit(
            [cell(`prod-${i}`, 2, i, String(productShares[i]), productShares[i] as number, "comparing")],
            `Party ${i + 1} multiplies shares locally: ${sharesA[i]} * ${sharesB[i]} = ${productShares[i]} mod ${p}; degree rose to 2t.`,
            4,
            { stage: "product", party: i + 1, productShares: [...productShares] },
        );
    }
    const reduced = share(product, p, parties, t, 3);
    yield emit(
        reduced.map((value, i) => cell(`red-${i}`, 2, i, String(value), value, "active")),
        `Degree reduction: the degree-2 product is re-shared as degree ${t}, giving fresh shares.`,
        5,
        { stage: "reduce", reduced: [...reduced], product },
    );
    const productAgain = reconstruct(reduced, p);
    yield emit(
        [cell("sum-final", 0, 0, `sum=${sum}`, sum, "sorted"), cell("prod-final", 1, 0, `product=${productAgain}`, productAgain, "sorted")],
        `Done: sum ${sum} and product ${productAgain} were computed without opening the private inputs.`,
        6,
        { stage: "done", sum, product: productAgain, sharesA, sharesB, sumShares, productShares, reduced },
    );
}

/** The BGW secure computation module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Splitting a secret into random shares hides it from any small group of parties, yet the shares still carry enough structure to compute with. Adding secrets is adding shares. Multiplying is local multiplication followed by a degree-reduction step that keeps the sharing valid. At the end the parties reconstruct the answer, and no party ever sees another party's input.",
        invariants: [
            "The constant term of each sharing polynomial is the secret.",
            "Any t or fewer shares are insufficient to reconstruct the secret.",
            "All parties together reconstruct the polynomial at x=0 exactly.",
        ],
        correctness:
            "Shamir sharing is linear, so share(a)_i + share(b)_i are shares of a+b and local addition reconstructs the sum. Local multiplication gives shares of the product polynomial of degree 2t; because n is greater than 2t, the n resulting points determine that polynomial, so interpolation at x=0 yields a*b exactly. Re-sharing the product at degree t restores a valid sharing for later gates. In a real deployment the extra coefficients are drawn uniformly at random, so t points impose no constraint on the constant term; this toy derives them deterministically to keep the replay reproducible.",
        complexityRationale:
            "Each reconstruction evaluates Lagrange basis terms over n points, costing O(n^2) field operations. Storing one share per party per secret uses O(n) space.",
        uses: [
            "Privacy-preserving statistical aggregation across organizations",
            "Secure auctions and joint computation without a trusted party",
            "A teaching model for threshold cryptography and MPC",
        ],
        references: [
            "Ben-Or, Goldwasser, and Wigderson, Completeness Theorems for Non-Cryptographic Fault-Tolerant Distributed Computation, 1988",
            "Shamir, How to Share a Secret, 1979",
        ],
        workedExample:
            "With three parties, modulus 23, secrets a=7 and b=4, each secret becomes three points on a line. Parties add their points to reconstruct 11. They multiply points to get three points on a parabola; interpolation at zero returns 28 mod 23 = 5, the product, after which a fresh line sharing of 5 is created.",
    },
    id: "bgw-protocol",
    name: "BGW Secure Multiparty Computation (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { a: 7, b: 4, p: 23, parties: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime modulus and three evaluating parties",
        "shamir-share each secret on a random degree-one polynomial",
        "send one share of each secret to every party",
        "add shares locally and interpolate to obtain the sum",
        "multiply shares locally to obtain degree-two shares",
        "interpolate the product and re-share it at degree one",
        "reconstruct and report sum and product",
    ],
};

export default module;
