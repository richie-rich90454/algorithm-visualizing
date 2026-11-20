/**
 * elgamal-commitment.ts - ElGamal Commitment Scheme
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An ElGamal commitment lets a committer fix a value now and reveal it later.
 * In a cyclic group with generator g and a public element h = g^x for a hidden
 * x, a commitment to a message m is c = g^m * h^r mod p with a fresh random
 * r. To open it the committer publishes (m, r), and anyone checks that the
 * formula reproduces c. Because r masks the exponent of g, many messages could
 * have produced the same c to an observer who does not know x; recovering x is
 * the discrete logarithm problem. This is an intentionally small toy instance
 * for visualization, not production parameters.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log m + log r) modular multiplications via square and multiply
 *   Space: O(1) for the group elements
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the generator power, the blinding power and the commitment.
 *   - A valid opening is green; a forged opening is red.
 *   - meta carries the public parameters, the commitment and both verdicts.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CommitInput {
    p?: number;
    g?: number;
    x?: number;
    message?: number;
    randomness?: number;
    forgery?: { message?: number; randomness?: number };
}

/** Modular exponentiation by repeated squaring. */
function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = ((base % modulus) + modulus) % modulus;
    let e = Math.floor(exponent);
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Compute the commitment c = g^m * h^r mod p. */
function commit(message: number, randomness: number, g: number, h: number, p: number): number {
    return (modPow(g, message, p) * modPow(h, randomness, p)) % p;
}

/** Build three cells for the two powers and the resulting commitment. */
function makeCells(
    gm: number,
    hr: number,
    c: number,
    states: [EntityState, EntityState, EntityState],
): VisualEntity[] {
    const values = [gm, hr, c];
    const labels = ["g^m", "h^r", "commitment"];
    return values.map((value, i) => ({
        id: `value-${i}`,
        type: "cell" as const,
        label: `${labels[i]}=${value}`,
        value,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, kind: labels[i] ?? "" },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CommitInput | null) ?? {};
    const p = Math.max(3, Math.floor(Number(task.p ?? 1009)) || 1009);
    const g = Math.max(2, Math.floor(Number(task.g ?? 11)) || 11) % p;
    const x = Math.max(1, Math.floor(Number(task.x ?? 7)) || 7);
    const message = Math.max(0, Math.floor(Number(task.message ?? 42)) || 0);
    const randomness = Math.max(0, Math.floor(Number(task.randomness ?? 17)) || 0);
    const h = modPow(g, x, p);
    const gm = modPow(g, message, p);
    const hr = modPow(h, randomness, p);
    const c = (gm * hr) % p;
    const forgery = task.forgery ?? {};
    const falseMessage = Math.floor(Number(forgery.message ?? message + 1));
    const falseRandomness = Math.floor(Number(forgery.randomness ?? randomness));
    const falseC = commit(falseMessage, falseRandomness, g, h, p);
    let step = 0;
    const emit = (description: string, codeLine: number, states: [EntityState, EntityState, EntityState], extra: Record<string, unknown>) => ({
        stepNumber: step++,
        entities: makeCells(gm, hr, c, states),
        edges: [],
        description,
        codeLineNumber: codeLine,
        layout: "grid" as const,
        meta: {
            p,
            g,
            h,
            x,
            message,
            randomness,
            commitment: c,
            openingValid: 1,
            ...extra,
        },
    });

    yield emit(`Public parameters p=${p}, g=${g}, h=g^x=${h} with a hidden exponent x.`, 0, ["idle", "idle", "idle"], { phase: "setup" });
    yield emit(`Compute g^m = ${gm} and h^r = ${hr} for message ${message} and nonce ${randomness}.`, 2, ["active", "active", "idle"], { phase: "powers" });
    yield emit(`Publish the commitment c = g^m * h^r mod p = ${c}.`, 4, ["sorted", "sorted", "comparing"], { phase: "commit" });
    yield emit(`Opening with (m=${message}, r=${randomness}) recomputes ${c} and verifies.`, 6, ["sorted", "sorted", "sorted"], { phase: "verify", openingValid: 1 });
    const forgedValid = falseC === c ? 1 : 0;
    yield emit(
        forgedValid
            ? "The forged pair reproduces the commitment in this small toy group; the parameters are too small to be binding."
            : `Forged pair (m=${falseMessage}, r=${falseRandomness}) yields ${falseC}, which differs from ${c}; rejected.`,
        8,
        ["error", "idle", "error"],
        { phase: "forgery", forgery: { message: falseMessage, randomness: falseRandomness }, forgedValue: falseC, forgedValid },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To commit to a secret number, raise a public generator to that number and multiply by a second public element raised to a random nonce. Publish only the product. Later reveal both the number and the nonce so anyone can redo the multiplication and check the product matches. The random nonce hides the message, while finding a different pair that gives the same product would require solving a discrete logarithm in the group.",
        invariants: [
            "The commitment is g to the message times h to the nonce, reduced mod p.",
            "The public value h equals g to the hidden exponent x mod p.",
            "An opening verifies exactly when it reproduces the stored commitment.",
        ],
        correctness:
            "The verifier recomputes g^m h^r mod p using only public values and compares it to the stored c, so the genuine opening always passes because it is the same computation used at commit time. A different message with the same nonce changes the factor g^m unless the group order divides the difference; choosing a large group makes that negligible. Finding a matching nonce for a different message requires deriving x from h, an instance of the discrete logarithm problem, which is infeasible for proper parameters. The small prime used here is for demonstration only.",
        complexityRationale:
            "Square-and-multiply uses O(log exponent) modular multiplications for each power, and the two powers are multiplied once, so commitment and verification are O(log m + log r). Only a constant number of group elements are kept, giving O(1) space.",
        uses: [
            "Coin flipping and rock-paper-scissors over a network",
            "Sealed-bid auctions where bids open after the deadline",
            "Building blocks for zero-knowledge proofs and multiparty computation",
        ],
        references: [
            "ElGamal, A Public Key Cryptosystem and a Signature Scheme Based on Discrete Logarithms, 1985",
            "Goldreich, Foundations of Cryptography, Volume 1, chapter on commitment schemes",
        ],
        workedExample:
            "With p=1009, g=11 and hidden x=7, the public element is h=11^7 mod 1009. To commit to message 42 with nonce 17, compute g^42 and h^17, multiply them mod 1009 and publish only the product. Revealing (42, 17) lets a verifier repeat the product and accept. Revealing (43, 17) produces a different product and is rejected.",
    },
    id: "elgamal-commitment",
    name: "ElGamal Commitment",
    category: "cryptography-security",
    complexity: { time: "O(log m + log r)", space: "O(1)" },
    defaultInput: {
        p: 1009,
        g: 11,
        x: 7,
        message: 42,
        randomness: 17,
        forgery: { message: 43, randomness: 17 },
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a prime modulus p, a generator g and a secret exponent x",
        "publish h equal to g to the x mod p",
        "pick the message m and a fresh random nonce r",
        "compute g to the m mod p",
        "compute h to the r mod p",
        "publish the product c of those two powers mod p",
        "to open, reveal m and r and recompute the product",
        "accept when the recomputed value equals c",
        "done: report the commitment and both verdicts",
    ],
};

export default module;
