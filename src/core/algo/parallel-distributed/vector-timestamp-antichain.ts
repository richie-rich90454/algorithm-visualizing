/**
 * vector-timestamp-antichain.ts - Vector Timestamp Antichain Delivery
 *
 * A receiver keeps an antichain of vector timestamps: a set of mutually
 * incomparable versions it has already delivered. A new timestamp is delivered
 * only when no existing entry dominates it; on delivery, every older entry it
 * dominates is pruned. This is the causal filtering used by reliable causal
 * broadcast protocols.
 *
 * Time:  O(events * antichain * processes) for the dominance checks
 * Space: O(antichain * processes) for the retained versions
 *
 * Visualization: a grid shows each retained vector as a row, with a trailing
 * incoming row; a green incoming row is delivered, a red one is discarded.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type StampEvent = { label: string; vector: number[] };

/** True when a dominates b component-wise (a[i] >= b[i] for every i). */
export function dominates(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
    }
    return true;
}

/** Build the antichain grid; the incoming vector is the final row. */
function makeCells(chain: Array<{ label: string; vector: number[] }>, incoming: number[] | null, keep: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const render = (row: number, vector: number[], state: EntityState, prefix: string): void => {
        vector.forEach((value, col) => {
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(value),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, kind: prefix },
            });
        });
    };
    chain.forEach((entry, row) => render(row, entry.vector, "sorted", "kept"));
    if (incoming) render(chain.length, incoming, keep ? "comparing" : "error", "incoming");
    return cells;
}

/** The vector timestamp antichain generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number; events?: StampEvent[] } | null) ?? {};
    const processes = typeof task.processes === "number" && task.processes > 0 ? Math.floor(task.processes) : 3;
    const events: StampEvent[] = Array.isArray(task.events) && task.events.length > 0
        ? task.events.map((e, i) => ({
            label: typeof e?.label === "string" ? e.label : `m${i}`,
            vector: Array.from({ length: processes }, (_, k) => Math.max(0, Math.floor(e?.vector?.[k] ?? 0))),
        }))
        : [
            { label: "a", vector: [1, 0, 0] },
            { label: "b", vector: [0, 1, 0] },
            { label: "c", vector: [1, 1, 0] },
            { label: "d", vector: [1, 0, 0] },
        ];
    const chain: Array<{ label: string; vector: number[] }> = [];
    let delivered = 0;
    let discarded = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(chain, null, false),
        edges: [],
        description: `Receiver starts with an empty antichain over ${processes} process component(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: processes, processes, chain: [], delivered: 0, discarded: 0, verdict: "start" },
    };
    step += 1;

    for (const event of events) {
        const shadowed = chain.some((e) => dominates(e.vector, event.vector));
        const keep = !shadowed;
        if (keep) {
            const survivors = chain.filter((e) => !dominates(event.vector, e.vector));
            chain.length = 0;
            chain.push(...survivors, { label: event.label, vector: event.vector });
            delivered += 1;
        } else {
            discarded += 1;
        }
        yield {
            stepNumber: step,
            entities: makeCells(chain.filter((e) => keep || e.label !== event.label || e.vector !== event.vector), event.vector, keep),
            edges: [],
            description: keep
                ? `Delivered ${event.label} [${event.vector.join(",")}]: no retained version dominates it; ${chain.length} version(s) remain.`
                : `Discarded ${event.label} [${event.vector.join(",")}]: a retained version already dominates it.`,
            codeLineNumber: keep ? 3 : 2,
            layout: "grid",
            meta: {
                rows: chain.length + 1,
                cols: processes,
                processes,
                chain: chain.map((e) => `${e.label}:${e.vector.join(",")}`),
                delivered,
                discarded,
                verdict: keep ? "deliver" : "discard",
                incoming: event.vector,
                incomingLabel: event.label,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(chain, null, false),
        edges: [],
        description: `Filtering complete: ${delivered} delivered, ${discarded} discarded, ${chain.length} incomparable version(s) retained.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: Math.max(1, chain.length),
            cols: processes,
            processes,
            chain: chain.map((e) => `${e.label}:${e.vector.join(",")}`),
            delivered,
            discarded,
            verdict: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vector timestamp records how many events each process has seen, so one timestamp dominates another when it is at least as large in every component. A receiver that has delivered a newer vector can silently ignore any older message it later hears about. Keeping only the maximal, mutually incomparable vectors as an antichain is enough to decide future deliveries without storing the entire history.",
        invariants: [
            "No vector in the retained antichain dominates another retained vector.",
            "Every delivered event's vector is retained until a strictly newer vector supersedes it.",
            "A dominated incoming timestamp is discarded without changing the antichain.",
        ],
        correctness:
            "Component-wise dominance is exactly the happened-before relation for vector clocks, so if a retained vector dominates an incoming one, the incoming event is causally old and its delivery is redundant. When an incoming vector is not dominated, it is delivered and every entry it dominates is removed; the remaining entries are still pairwise incomparable because removing elements cannot create a dominance relation. Thus the antichain is minimal and complete for the dominance test, giving correct causal filtering.",
        complexityRationale:
            "Each event is compared against at most a antichain entries over p components, O(a * p) per event and O(events * a * p) overall. The retained antichain holds at most one vector per delivered event, O(events * p) space.",
        uses: [
            "Causal delivery in reliable and Byzantine-tolerant broadcast",
            "Version conflict filtering in replicated data stores",
            "Deduplication of causally ordered event streams",
        ],
        references: [
            "Birman, Schiper, and Stephenson, Lightweight Causal and Atomic Group Multicast, 1991",
            "Reiter, Secure Agreement and Causal Broadcast, 1994",
        ],
        workedExample:
            "With three components, deliver [1,0,0] and [0,1,0], which are incomparable. Next [1,1,0] dominates both, so it is delivered and those two are pruned, leaving only [1,1,0]. A repeat of [1,0,0] is then discarded because [1,1,0] dominates it.",
    },
    id: "vector-timestamp-antichain",
    name: "Vector Timestamp Antichain",
    category: "parallel-distributed",
    complexity: { time: "O(events * antichain * processes)", space: "O(events * processes)" },
    defaultInput: {
        processes: 3,
        events: [
            { label: "a", vector: [1, 0, 0] },
            { label: "b", vector: [0, 1, 0] },
            { label: "c", vector: [1, 1, 0] },
            { label: "d", vector: [1, 0, 0] },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty antichain of vector timestamps",
        "for each incoming timestamp t",
        "if some retained vector dominates t discard t",
        "otherwise remove every retained vector that t dominates",
        "append t to the antichain and deliver its event",
        "assert no retained vector dominates another",
        "record the delivered and discarded counts",
        "done: report the final minimal antichain",
    ],
};

export default module;
