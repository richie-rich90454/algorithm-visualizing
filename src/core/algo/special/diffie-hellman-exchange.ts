/**
 * diffie-hellman-exchange.ts – Diffie–Hellman Key Exchange.
 * Public p=23, g=5. Alice picks a=6 (A=8), Bob picks b=15 (B=19);
 * both sides derive the same shared secret s=2 over an open channel.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const modPow = (base: number, exp: number, mod: number): number => {
    let r = 1;
    let b = base % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) r = (r * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return r;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { p?: number; g?: number; a?: number; b?: number } | null) ?? {};
    const p = 23;
    const g = 5;
    const a = Math.max(1, Math.min(p - 2, cfg.a ?? 6));
    const b = Math.max(1, Math.min(p - 2, cfg.b ?? 15));
    void cfg.p;
    void cfg.g;
    const A = modPow(g, a, p);
    const B = modPow(g, b, p);
    const sa = modPow(B, a, p);
    const sb = modPow(A, b, p);
    const stages: Array<[string, Array<[string, number, EntityState]>]> = [
        [
            `Public channel: p=${p}, g=${g}; secrets a=${a} (Alice), b=${b} (Bob) stay private.`,
            [
                ["p", p, "idle"],
                ["g", g, "idle"],
                ["a", a, "highlight"],
                ["b", b, "highlight"],
            ],
        ],
        [
            `Alice sends A=g^a mod p = ${A}; Bob learns nothing about a (discrete log).`,
            [
                ["A", A, "comparing"],
                ["a", a, "visited"],
            ],
        ],
        [
            `Bob sends B=g^b mod p = ${B}; Alice learns nothing about b.`,
            [
                ["B", B, "comparing"],
                ["b", b, "visited"],
            ],
        ],
        [
            `Alice computes s=B^a mod p = ${sa}.`,
            [
                ["s", sa, "comparing"],
                ["B", B, "visited"],
                ["a", a, "visited"],
            ],
        ],
        [
            `Bob computes s=A^b mod p = ${sb}. Match: ${sa === sb}.`,
            [
                ["s", sb, sa === sb ? "sorted" : "error"],
                ["A", A, "visited"],
                ["b", b, "visited"],
            ],
        ],
    ];
    let step = 0;
    for (let i = 0; i < stages.length; i += 1) {
        const [desc, cells] = stages[i] as [string, Array<[string, number, EntityState]>];
        const entities: VisualEntity[] = cells.map(([k, v, st], j) => ({
            id: `dh-${i}-${j}`,
            type: "cell" as const,
            label: `${k}=${v}`,
            value: v,
            state: st,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: j },
        }));
        yield {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(i, 6),
            layout: "grid",
            meta: { sharedSecret: sa, match: sa === sb },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [
            {
                id: "dh-secret",
                type: "cell" as const,
                label: `s=${sa}`,
                value: sa,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 5, col: 0 },
            },
        ],
        edges: [],
        description: `Shared secret s=${sa}: both sides agree without ever sending it.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { sharedSecret: sa, match: sa === sb },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Diffie-Hellman lets two parties agree on a shared secret over a public channel. Each picks a private exponent, publishes g raised to that exponent modulo p, then combines the other's public value with its own secret. Both arrive at the same number because (g^a)^b equals (g^b)^a modulo p, while an eavesdropper cannot feasibly recover the secret.",
        "invariants": [
            "Only A = g^a mod p and B = g^b mod p are transmitted; the private exponents stay local.",
            "Alice's secret a and Bob's secret b never leave their owners.",
            "The two derived secrets are equal: B^a and A^b are both g^(ab) mod p."
        ],
        "correctness": "By the laws of exponents in the multiplicative group modulo p, B^a = (g^b)^a = g^(ab) = (g^a)^b = A^b, so both parties compute the same s. Security rests on the discrete logarithm problem: recovering a from A is believed infeasible for a large prime p.",
        "complexityRationale": "Modular exponentiation by repeated squaring needs O(log exponent) multiplications, so computing public values and the shared secret is O(log p) time. Only a handful of integers are stored, O(1) space.",
        "uses": [
            "TLS/SSL key agreement in DHE cipher suites",
            "VPN key exchange in IPsec IKE and SSH",
            "Secure messaging protocols such as Signal's extended triple Diffie-Hellman",
            "PGP and many other cryptographic protocols"
        ],
        "references": [
            "Diffie and Hellman, New Directions in Cryptography, IEEE Transactions on Information Theory, 1976",
            "Menezes, van Oorschot and Vanstone, Handbook of Applied Cryptography, Chapter 8"
        ],
        "workedExample": "Public values p=23 and g=5. Alice picks a=6 and sends A=5^6 mod 23=8; Bob picks b=15 and sends B=5^15 mod 23=19. Alice computes s=B^a=19^6 mod 23=2 and Bob computes s=A^b=8^15 mod 23=2. Both share s=2 without ever transmitting it."
    },
    id: "diffie-hellman-exchange",
    name: "Diffie–Hellman Exchange",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { a: 6, b: 15 },
    visualType: "grid",
    run,
    pseudocode: [
        "publish prime p=23 and generator g=5 openly",
        "Alice picks secret a and computes A <- g^a mod p",
        "Bob picks secret b and computes B <- g^b mod p",
        "exchange public values A and B over the channel",
        "Alice computes s <- B^a mod p locally",
        "Bob computes s <- A^b mod p locally",
        "done: both sides share secret s without sending it",
    ],
};

export default module;
