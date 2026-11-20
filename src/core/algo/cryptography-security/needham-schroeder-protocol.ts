/**
 * needham-schroeder-protocol.ts - Needham-Schroeder Symmetric Key Protocol (Toy)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Needham-Schroeder symmetric key protocol lets two principals authenticate
 * each other and establish a fresh session key with the help of a trusted
 * server. A sends a nonce to the server, the server returns a session key
 * wrapped for A together with a ticket wrapped for B, A forwards the ticket,
 * and B challenges A with a fresh nonce that A must transform and return. The
 * nonces prove that the messages are from the current run rather than a replay.
 * Encryption here is a toy XOR mask, so this is a teaching model and makes no
 * security claim.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(1) messages and mask operations
 *   Space: O(1) messages and session values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the five protocol messages in transit as masked integers.
 *   - The final frame highlights the mutual-authentication verdict.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Toy "encryption" as XOR with a numeric key; it is an involution and not secure. */
export function mask(key: number, value: number): number {
    return (value ^ key) >>> 0;
}

export interface NSSession {
    a: number;
    b: number;
    nonceA: number;
    nonceB: number;
    sessionKey: number;
    keyAS: number;
    keyBS: number;
}

export interface NSMessage {
    step: number;
    from: string;
    to: string;
    label: string;
    value: number;
}

export interface NSResult {
    messages: NSMessage[];
    ticket: number;
    sessionKeyAtB: number;
    replyAtB: number;
    authenticated: boolean;
}

/** B's check given a ticket and A's final reply, possibly from a different run. */
export function authenticate(s: NSSession, ticket: number, reply: number): boolean {
    const sessionKeyAtB = mask(s.keyBS, ticket);
    const replyAtB = mask(sessionKeyAtB, reply);
    return sessionKeyAtB === s.sessionKey && replyAtB === s.nonceB - 1;
}

/** Simulate the five-message protocol and decide whether both sides authenticate. */
export function runNeedhamSchroeder(s: NSSession): NSResult {
    const message1 = mask(s.keyAS, s.nonceA);
    const outer = mask(s.keyAS, s.nonceA ^ s.sessionKey);
    const ticket = mask(s.keyBS, s.sessionKey);
    const message3 = ticket;
    const message4 = mask(s.sessionKey, s.nonceB);
    const sessionKeyAtB = mask(s.keyBS, message3);
    const replyPlain = mask(s.sessionKey, message4);
    const message5 = mask(s.sessionKey, replyPlain - 1);
    const replyAtB = mask(s.sessionKey, message5);

    const nonceFromServer = mask(s.keyAS, outer) ^ s.sessionKey;
    const aAcceptedServer = nonceFromServer === s.nonceA;
    const bAcceptedTicket = sessionKeyAtB === s.sessionKey;
    const bAuthenticated = authenticate(s, ticket, message5);

    const messages: NSMessage[] = [
        { step: 1, from: "A", to: "S", label: "request with nonce A", value: message1 },
        { step: 2, from: "S", to: "A", label: "nonce A and session key in server key", value: outer },
        { step: 3, from: "A", to: "B", label: "encrypted ticket for B", value: message3 },
        { step: 4, from: "B", to: "A", label: "challenge nonce B", value: message4 },
        { step: 5, from: "A", to: "B", label: "transformed nonce B", value: message5 },
    ];

    return {
        messages,
        ticket,
        sessionKeyAtB,
        replyAtB,
        authenticated: aAcceptedServer && bAcceptedTicket && bAuthenticated,
    };
}

function makeBars(result: NSResult, revealed: number): VisualEntity[] {
    return result.messages.map((message, index) => ({
        id: `msg-${message.step}`,
        type: "bar" as const,
        label: `${message.from} to ${message.to}: ${message.value}`,
        value: message.value,
        state: (index < revealed ? "visited" : index === revealed ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { step: message.step, sender: message.from, receiver: message.to },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<NSSession> | null) ?? {};
    const session: NSSession = {
        a: typeof task.a === "number" ? task.a : 1,
        b: typeof task.b === "number" ? task.b : 2,
        nonceA: typeof task.nonceA === "number" ? task.nonceA >>> 0 : 101,
        nonceB: typeof task.nonceB === "number" ? task.nonceB >>> 0 : 202,
        sessionKey: typeof task.sessionKey === "number" ? task.sessionKey >>> 0 : 777,
        keyAS: typeof task.keyAS === "number" ? task.keyAS >>> 0 : 55,
        keyBS: typeof task.keyBS === "number" ? task.keyBS >>> 0 : 99,
    };
    const result = runNeedhamSchroeder(session);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(result, -1),
        edges: [],
        description: `Needham-Schroeder toy run: A=${session.a}, B=${session.b}, server S establishes a fresh session key ${session.sessionKey}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { sessionKey: session.sessionKey, nonceA: session.nonceA, nonceB: session.nonceB, authenticated: false },
    };
    step += 1;

    for (let i = 0; i < result.messages.length; i += 1) {
        const message = result.messages[i];
        yield {
            stepNumber: step,
            entities: makeBars(result, i),
            edges: [],
            description: `Message ${message?.step}: ${message?.from} to ${message?.to}, ${message?.label}, value ${message?.value}.`,
            codeLineNumber: (i + 1) as number,
            layout: "array",
            meta: { step: message?.step ?? 0, from: message?.from ?? "", to: message?.to ?? "", value: message?.value ?? 0, authenticated: false },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result, result.messages.length - 1),
        edges: [],
        description: result.authenticated
            ? `Mutual authentication succeeds: B recovered the session key and verified A's response to the fresh nonce. Toy XOR masks, not secure.`
            : `Authentication fails: a nonce or ticket check did not match.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            sessionKey: session.sessionKey,
            sessionKeyAtB: result.sessionKeyAtB,
            replyAtB: result.replyAtB,
            authenticated: result.authenticated,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Needham-Schroeder uses a trusted server to hand two parties a fresh session key and then lets the parties prove to each other that they hold it. A starts with a nonce so the server's reply is tied to this run. B receives an encrypted ticket and later challenges A with its own fresh nonce, which A must reduce by one and send back. Nonces stop an attacker from replaying old messages, because the numbers would no longer match the current run.",
        invariants: [
            "The server returns the session key decrypted by A together with a ticket meant only for B.",
            "B trusts the session key only after it decrypts the ticket with its own key.",
            "A proves knowledge of the key by transforming B's fresh nonce exactly as expected.",
        ],
        correctness:
            "The toy masks are XOR operations, so masking twice with the same key recovers the value. A unmasks the server reply and sees the nonce it chose, confirming the reply is fresh. B unmasks the ticket to obtain the session key, then unmasks A's final reply and checks it equals its nonce minus one. An old ticket from a previous run carries a different key, so B's nonce challenge does not match and authentication fails. Tests check the honest run succeeds while tampering and replay are rejected. Real deployments must use a secure authenticated cipher because plain XOR and the historical protocol have known weaknesses.",
        complexityRationale:
            "The protocol exchanges a fixed five messages and each mask is a single XOR, so time and space are constant with respect to any input size.",
        uses: [
            "Historical foundation for symmetric key distribution and mutual authentication",
            "Teaching nonce freshness, replay prevention, and trusted third parties",
            "Precursor to protocols such as Kerberos",
        ],
        references: [
            "Needham and Schroeder, Using Encryption for Authentication in Large Networks of Computers, 1978",
            "Denning and Sacco, Timestamps in Key Distribution Protocols, 1981",
        ],
        workedExample:
            "A sends nonce 101 to the server, which returns session key 777 wrapped for A plus a ticket wrapped for B. A forwards the ticket; B unwraps it to learn 777, challenges A with nonce 202, and A replies with 201 encrypted under 777. B decrypts, sees 201, and accepts. Replaying an old ticket with a different key makes the reply fail the nonce check.",
    },
    id: "needham-schroeder-protocol",
    name: "Needham-Schroeder Protocol (Toy)",
    category: "cryptography-security",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { a: 1, b: 2, nonceA: 101, nonceB: 202, sessionKey: 777, keyAS: 55, keyBS: 99 },
    visualType: "array",
    run,
    pseudocode: [
        "A sends its identity, B's identity, and a fresh nonce to the server",
        "server returns the nonce and a new session key sealed for A",
        "server also returns a ticket containing the key sealed for B",
        "A forwards the ticket to B",
        "B sends a fresh nonce sealed with the session key",
        "A returns the nonce minus one sealed with the session key",
        "done: report whether both sides authenticated",
    ],
};

export default module;
