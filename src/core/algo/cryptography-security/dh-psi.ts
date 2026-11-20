/**
 * dh-psi.ts - Diffie-Hellman Private Set Intersection (Toy Field)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DH-based private set intersection lets a client learn which of its items a
 * server holds without revealing the other client items. The client raises a
 * hash of each of its items to a secret exponent a. The server raises those
 * values to its own secret b and also blinds its own items with b. After the
 * client raises the server's blinded items to a, both sets live in the same
 * exponent space g^(a*b*h(item)), so equal values reveal an intersection while
 * nonmatching items stay hidden. This module runs the protocol in a small
 * prime field with a toy hash, so it is a teaching model, not a secure PSI.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O((|X| + |Y|) log p) modular exponentiations
 *   Space: O(|X| + |Y|) transmitted values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Rows show the client items, the server items, and the matched indices.
 *   - A matching client item is highlighted as discovered.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** The toy prime field and generator. */
export const PRIME = 1009;
/** Eleven is a primitive root modulo 1009, so exponent equality is exact. */
export const GENERATOR = 11;

/** Modular exponentiation by repeated squaring. */
export function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1 % modulus;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Map an item to a deterministic nonzero exponent below the group order. */
export function hashExponent(item: number, prime = PRIME): number {
    return ((item % (prime - 2)) + prime - 2) % (prime - 2) + 1;
}

/** Reduce a secret to an exponent coprime to the group order. */
function coprimeExponent(secret: number): number {
    let value = ((secret % (PRIME - 1)) + PRIME - 1) % (PRIME - 1);
    while (value === 0 || gcd(value, PRIME - 1) !== 1) {
        value += 1;
    }
    return value;
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}

export interface DhPsiTranscript {
    clientBlinded: number[];
    serverBlinded: number[];
    serverAnswer: number[];
    clientCheck: number[];
    intersection: number[];
}

/** Run the DH-based PSI protocol and return every transmitted set. */
export function dhPsi(clientItems: number[], serverItems: number[], a: number, b: number): DhPsiTranscript {
    const clientSecret = coprimeExponent(a);
    const serverSecret = coprimeExponent(b);
    const clientBlinded = clientItems.map((x) => modPow(GENERATOR, (clientSecret * hashExponent(x)) % (PRIME - 1), PRIME));
    const serverBlinded = serverItems.map((y) => modPow(GENERATOR, (serverSecret * hashExponent(y)) % (PRIME - 1), PRIME));
    const serverAnswer = clientBlinded.map((value) => modPow(value, serverSecret, PRIME));
    const clientCheck = serverBlinded.map((value) => modPow(value, clientSecret, PRIME));
    const intersection = clientItems.filter((_, i) => clientCheck.includes(serverAnswer[i] ?? -1));
    return { clientBlinded, serverBlinded, serverAnswer, clientCheck, intersection };
}

function rowCells(row: number, values: number[], state: EntityState, matched: boolean[] = []): VisualEntity[] {
    return Array.from({ length: 8 }, (_, col) => {
        const present = col < values.length;
        const value = values[col] ?? 0;
        return {
            id: `item-${row}-${col}`,
            type: "cell" as const,
            label: present ? String(value) : "-",
            value,
            state: !present ? ("unvisited" as EntityState) : matched[col] ? "sorted" : state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row, col },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { clientItems?: number[]; serverItems?: number[]; clientSecret?: number; serverSecret?: number } | null) ?? {};
    const clientItems = Array.isArray(task.clientItems) ? task.clientItems : [11, 22, 33, 44];
    const serverItems = Array.isArray(task.serverItems) ? task.serverItems : [22, 44, 66];
    const a = typeof task.clientSecret === "number" ? task.clientSecret : 13;
    const b = typeof task.serverSecret === "number" ? task.serverSecret : 17;

    const transcript = dhPsi(clientItems, serverItems, a, b);
    const matched = clientItems.map((x) => transcript.intersection.includes(x));
    let step = 0;

    const frame = (phase: number, description: string, line: number): VisualFrame => ({
        stepNumber: step++,
        entities: [
            ...rowCells(0, phase >= 1 ? clientItems : [], phase >= 1 ? "active" : "unvisited", phase >= 2 ? matched : []),
            ...rowCells(1, phase >= 2 ? serverItems : [], phase >= 2 ? "pivot" : "unvisited"),
            ...rowCells(2, phase >= 3 ? transcript.intersection : [], phase >= 3 ? "sorted" : "unvisited"),
        ],
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 8,
            prime: PRIME,
            clientCount: clientItems.length,
            serverCount: serverItems.length,
            intersection: transcript.intersection,
            clientBlinded: transcript.clientBlinded,
            serverBlinded: transcript.serverBlinded,
        },
    });

    yield frame(0, "Agree on a prime field and a deterministic item-to-exponent hash.", 0);
    yield frame(1, "Client blinds each item with secret exponent a.", 1);
    yield frame(2, "Server raises the client values to b and blinds its own items with b.", 2);
    yield frame(3, `Client raises the server values to a and finds ${transcript.intersection.length} match(es).`, 3);
}

const module: AlgorithmModule = {
    id: "dh-psi",
    name: "Diffie-Hellman Private Set Intersection (Toy Field)",
    category: "cryptography-security",
    complexity: { time: "O((n + m) log p)", space: "O(n + m)" },
    defaultInput: { clientItems: [11, 22, 33, 44], serverItems: [22, 44, 66], clientSecret: 13, serverSecret: 17 },
    visualType: "grid",
    run,
    pseudocode: [
        "agree on a prime p, generator g, and a hash from items to exponents",
        "client picks secret a and sends g raised to a times hash(x) for each item x",
        "server picks secret b and raises each client value to b",
        "server blinds its own items as g raised to b times hash(y)",
        "server sends both shuffled sets back to the client",
        "client raises the server-blinded items to a",
        "equal values are the intersection; other items stay hidden",
    ],
    education: {
        intuition:
            "DH-based PSI hides the inputs by putting client and server items into the same multiplicative exponent space. Because exponentiation commutes, (g^{a h(x)})^b equals (g^{b h(y)})^a exactly when h(x) equals h(y). The server never sees the client's plain items, and the client only learns which of its own items matched.",
        invariants: [
            "The client's secret a is never transmitted; only g^(a h(x)) values are sent.",
            "The server's secret b is never transmitted; only g^(b h(y)) and the re-encrypted client values are sent.",
            "Equality of g^(a*b*h(value)) is equivalent to equality of the hashed items.",
        ],
        correctness:
            "For a client item x, the server returns g^(a h(x) b). For a server item y, the client computes (g^(b h(y)))^a = g^(b h(y) a). These are equal exactly when h(x) = h(y), which happens exactly when the items match under the deterministic hash. Since exponentiation is commutative in the multiplicative group, no party needs to reveal its secret exponent.",
        complexityRationale:
            "Each of the n client items and m server items needs a constant number of modular exponentiations, each O(log p) multiplications, so time is O((n + m) log p) and the transmitted sets use O(n + m) space.",
        uses: [
            "Private contact discovery in messaging applications",
            "Privacy-preserving ad conversion measurement",
            "Teaching commutative encryption and oblivious set operations",
        ],
        references: [
            "Meadows, A More Efficient Cryptographic Matchmaking Protocol, 1986",
            "De Cristofaro and Tsudik, Practical Private Set Intersection Protocols, 2010",
        ],
        workedExample:
            "With client items 11, 22, 33, 44 and server items 22, 44, 66, the client blinds with a = 13 and the server with b = 17. After the client raises the server's blinded values to 13, the values for 22 and 44 match the server's answers, so the reported intersection is 22 and 44 while 11, 33, and 66 stay hidden.",
    },
};

export default module;
