/**
 * quic-handshake.ts - QUIC Handshake With Loss Recovery
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * QUIC establishes a secure connection with a TLS 1.3 style exchange carried
 * in encrypted packets. This visualization replays the three handshake flights
 * (client Initial, server Initial plus Handshake, and client Handshake), models
 * deterministic packet loss, and retransmits any unacknowledged packet until
 * every flight is delivered. Once both nonces have crossed the wire, each side
 * derives the same session secret from a deterministic key schedule.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(packets sent) where each lost packet is retried once per attempt
 *   Space: O(flights * messages) for the packet state grid
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A grid with one row per flight and one column per message slot.
 *   - A delivered packet is green, a lost one red, a pending one yellow.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Flight {
    label: string;
    from: "C" | "S";
    msgs: string[];
}

const FLIGHTS: Flight[] = [
    { label: "Initial", from: "C", msgs: ["ClientHello"] },
    { label: "Handshake", from: "S", msgs: ["ServerHello", "Certificate", "Finished"] },
    { label: "1-RTT", from: "C", msgs: ["ClientFinished", "Data"] },
];
const COLS = 3;
const MAX_ATTEMPTS = 50;

/** FNV-1a key schedule over the two exchanged nonces. */
function deriveSecret(clientNonce: string, serverNonce: string): string {
    let hash = 0x811c9dc5;
    const input = `${clientNonce}|${serverNonce}`;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}

/** Render the flight-by-message packet grid. */
function makeCells(
    acked: Array<Set<number>>,
    currentFlight: number,
    lost: Set<string>,
    pending: Set<string>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < FLIGHTS.length; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            const key = `${row}-${col}`;
            const msg = FLIGHTS[row]?.msgs[col];
            let state: EntityState = "idle";
            if (row < currentFlight || (row === currentFlight && (acked[row]?.has(col) ?? false))) state = "sorted";
            else if (lost.has(key)) state = "error";
            else if (pending.has(key)) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: msg ?? "-",
                value: state === "sorted" ? 1 : state === "error" ? -1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, flight: FLIGHTS[row]?.label ?? "", message: msg ?? "" },
            });
        }
    }
    return entities;
}

/** The QUIC handshake generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { clientNonce?: string; serverNonce?: string; lossPattern?: boolean[] } | null) ?? {};
    const clientNonce = typeof task.clientNonce === "string" ? task.clientNonce : "client-random";
    const serverNonce = typeof task.serverNonce === "string" ? task.serverNonce : "server-random";
    const lossPattern = Array.isArray(task.lossPattern) && task.lossPattern.length > 0
        ? task.lossPattern.map(Boolean)
        : [false];
    const acked = FLIGHTS.map(() => new Set<number>());
    let sent = 0;
    let lostCount = 0;
    let clientSecret = "";
    let serverSecret = "";
    let complete = false;

    const meta = (flight: number, attempt: number, lost: Set<string>, pending: Set<string>) => ({
        rows: FLIGHTS.length,
        cols: COLS,
        flight,
        attempt,
        sent,
        lost: lostCount,
        delivered: acked.reduce((s, set) => s + set.size, 0),
        complete,
        clientSecret,
        serverSecret,
        secret: complete ? clientSecret : "",
        roundTrips: complete ? flight + 1 : flight,
        flightStates: lost.size + pending.size,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(acked, 0, new Set(), new Set()),
        edges: [],
        description: `QUIC handshake starting with client nonce ${clientNonce} and a ${lossPattern.length}-entry loss pattern.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, 0, new Set(), new Set()),
    };
    let step = 1;

    for (let f = 0; f < FLIGHTS.length; f += 1) {
        const flight = FLIGHTS[f] as Flight;
        let attempt = 0;
        while ((acked[f]?.size ?? 0) < flight.msgs.length && attempt < MAX_ATTEMPTS) {
            attempt += 1;
            const lost = new Set<string>();
            const pending = new Set<string>();
            for (let m = 0; m < flight.msgs.length; m += 1) {
                if (acked[f]?.has(m)) continue;
                const key = `${f}-${m}`;
                pending.add(key);
                const isLost = lossPattern[sent % lossPattern.length] ?? false;
                sent += 1;
                if (isLost) {
                    lostCount += 1;
                    lost.add(key);
                } else {
                    acked[f]?.add(m);
                }
                yield {
                    stepNumber: step,
                    entities: makeCells(acked, f, lost, pending),
                    edges: [],
                    description: `Flight ${f + 1} (${flight.label}) attempt ${attempt}: ${flight.msgs[m]} sent from ${flight.from === "C" ? "client" : "server"}, ${isLost ? "lost in the network and queued for retransmission" : "delivered and acknowledged"}.`,
                    codeLineNumber: isLost ? 3 : 2,
                    layout: "grid",
                    meta: meta(f, attempt, lost, pending),
                };
                step += 1;
            }
        }
        if (f === 1 && (acked[1]?.size ?? 0) === (FLIGHTS[1]?.msgs.length ?? 0)) {
            clientSecret = deriveSecret(clientNonce, serverNonce);
            serverSecret = deriveSecret(clientNonce, serverNonce);
        }
    }

    complete = acked.every((set, i) => set.size === (FLIGHTS[i]?.msgs.length ?? 0));
    const totalMsgs = FLIGHTS.reduce((s, f) => s + f.msgs.length, 0);
    yield {
        stepNumber: step,
        entities: makeCells(acked, FLIGHTS.length, new Set(), new Set()),
        edges: [],
        description: complete
            ? `Handshake complete in ${acked.length} flights after ${sent} packet(s) and ${lostCount} loss(es); shared secret ${clientSecret}.`
            : `Handshake incomplete: only ${acked.reduce((s, set) => s + set.size, 0)} of ${totalMsgs} packet(s) delivered within the retry limit.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...meta(FLIGHTS.length, 0, new Set(), new Set()), complete, secret: complete ? clientSecret : "" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "QUIC merges transport and TLS setup so a connection is ready in fewer round trips. The client and server exchange Initial packets, then Handshake packets carrying certificates and finished messages, and finally start sending one-RTT data. Packets can vanish on the way, so each side retransmits anything it has not seen acknowledged, just as TCP would, but without head-of-line blocking across streams.",
        invariants: [
            "A flight advances only after all of its messages are acknowledged.",
            "Each lost packet consumes one loss-pattern entry and is retried on the next attempt.",
            "Both endpoints derive the same session secret once the nonces have been exchanged.",
        ],
        correctness:
            "The retransmission loop delivers every unacknowledged message unless the loss pattern never yields a delivery, in which case an attempt cap stops the replay. Because flights proceed in order, a completed handshake means every required message reached its peer. The key schedule is a pure function of the two nonces, so computing it on both sides produces identical secrets, which is exactly the shared-secret property a handshake must establish.",
        complexityRationale:
            "Each packet send performs constant work and consumes one loss-pattern entry, so time is O(packets sent), including retransmissions. The packet-state grid holds one cell per flight and message slot, O(flights * messages) space.",
        uses: [
            "Explaining connection setup in HTTP/3 and QUIC-based transports",
            "Teaching loss recovery and retransmission without TCP head-of-line blocking",
            "Reasoning about key agreement in TLS 1.3 style handshakes",
        ],
        references: [
            "IETF RFC 9000, QUIC Transport Protocol, 2021",
            "IETF RFC 9001, Using TLS to Secure QUIC, 2021",
        ],
        workedExample:
            "With a loss pattern of true then false, the ClientHello is lost and retransmitted successfully. The server flight's first packet is then lost, retried, and delivered, and after the client flight completes both sides derive the same secret from the two nonces.",
    },
    id: "quic-handshake",
    name: "QUIC Handshake",
    category: "production-systems",
    complexity: { time: "O(packets sent)", space: "O(flights * messages)" },
    defaultInput: { clientNonce: "client-random", serverNonce: "server-random", lossPattern: [true, false, false] },
    visualType: "grid",
    run,
    pseudocode: [
        "exchange client and server nonces in the first flights",
        "for each handshake flight",
        "send every unacknowledged packet in the flight",
        "mark a packet delivered unless the loss pattern drops it",
        "retransmit dropped packets on the next attempt",
        "advance once the whole flight is acknowledged",
        "derive the shared secret and report handshake completion",
    ],
};

export default module;
