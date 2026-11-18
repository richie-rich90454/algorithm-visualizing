/**
 * lamport-clock.ts – Lamport Logical Clocks.
 * Three processes tick on every event; a receive takes max(local,
 * message)+1, so causally ordered events always carry ordered stamps.
 * Script: P0 works, sends to P1; P1 receives, sends to P2; P2 receives.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Ev = { p: number; kind: string; to?: number; msg?: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    void input;
    const clock = [0, 0, 0];
    const script: Ev[] = [
        { p: 0, kind: "internal" },
        { p: 0, kind: "send", to: 1, msg: 0 },
        { p: 1, kind: "receive" },
        { p: 1, kind: "send", to: 2, msg: 0 },
        { p: 2, kind: "receive" },
        { p: 2, kind: "internal" },
    ];
    const inbox = new Map<number, number>();
    let step = 0;
    const frame = (active: number, desc: string): VisualFrame => {
        const entities: VisualEntity[] = clock.map((c, i) => ({
            id: `p-${i}`,
            type: "cell" as const,
            label: `P${i}=${c}`,
            value: c,
            state: (i === active ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(step, 6),
            layout: "grid",
            meta: { clocks: [...clock] },
        };
    };
    yield frame(-1, "Three processes start at logical time 0.");
    step += 1;
    for (const ev of script) {
        let desc = "";
        if (ev.kind === "internal") {
            clock[ev.p] = (clock[ev.p] ?? 0) + 1;
            desc = `P${ev.p} internal event: tick to ${clock[ev.p]}.`;
        } else if (ev.kind === "send") {
            clock[ev.p] = (clock[ev.p] ?? 0) + 1;
            inbox.set(ev.to ?? 0, clock[ev.p] ?? 0);
            desc = `P${ev.p} sends (stamp ${clock[ev.p]}) to P${ev.to}.`;
        } else {
            const m = inbox.get(ev.p) ?? 0;
            clock[ev.p] = Math.max(clock[ev.p] ?? 0, m) + 1;
            desc = `P${ev.p} receives (stamp ${m}): clock jumps to ${clock[ev.p]}.`;
        }
        yield frame(ev.p, desc);
        step += 1;
    }
    const ordered = (clock[0] ?? 0) < (clock[1] ?? 0) && (clock[1] ?? 0) <= (clock[2] ?? 0);
    yield frame(
        -1,
        `Final [${clock.join(",")}]: send→receive stamps rise (${ordered ? "causal order preserved" : "concurrent events only"}).`,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Lamport clock assigns a number to each event so that cause and effect keep their order. Every process increments its counter on each event; when it sends a message it attaches the counter, and the receiver sets its clock to the maximum of local and received values plus one. This guarantees that if one event happens before another, the earlier one has a smaller timestamp.",
        "invariants": [
            "Each process's clock never decreases and rises by at least one per event.",
            "A send event's timestamp is strictly less than the matching receive event's timestamp.",
            "If event a happens-before event b, then timestamp(a) is less than timestamp(b)."
        ],
        "correctness": "By induction along the happens-before relation, local events increment the clock, and a receive takes the maximum with the sender's timestamp, which already dominates all causes of the message, then adds one. The clock value therefore respects causal order. The converse does not hold: ordered timestamps alone do not prove a causal link between concurrent events.",
        "complexityRationale": "Each event does constant work, an increment or a maximum, so e events cost O(e) overall and O(1) per event. Each process stores one integer, O(number of processes) space.",
        "uses": [
            "Causal timestamping in distributed logs and debugging",
            "Event ordering in distributed databases",
            "Distributed mutual exclusion such as Lamport's bakery algorithm",
            "Tracing and versioning in message-passing systems"
        ],
        "references": [
            "Lamport, Time, Clocks, and the Ordering of Events in a Distributed System, Communications of the ACM, 1978",
            "Coulouris et al., Distributed Systems: Concepts and Design, Chapter 18"
        ],
        "workedExample": "Three processes start at [0,0,0]. P0 has an internal event, giving [1,0,0], then sends with stamp 1 to P1. P1 receives and sets its clock to max(0,1)+1=2, yielding [1,2,0]. Each later send and receive keeps the send stamp strictly below the receive stamp, preserving causal order."
    },
    id: "lamport-clock",
    name: "Lamport Clock",
    category: "data-structures",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { processes: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize three processes with logical time 0",
        "tick clock by 1 on every internal event",
        "attach current stamp to every sent message",
        "on receive take max(local, message) plus 1",
        "process scripted sends and receives in order",
        "verify send to receive stamps always rise",
        "done: causal order preserved in final clocks",
    ],
};

export default module;
