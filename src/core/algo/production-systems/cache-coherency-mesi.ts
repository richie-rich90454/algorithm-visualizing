/**
 * cache-coherency-mesi.ts - MESI Cache Coherence Protocol
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MESI keeps private caches coherent for one memory line. A cache line is
 * Modified, Exclusive, Shared, or Invalid. Processor reads and writes drive
 * bus snoops that move lines between these states: a read obtains a shared or
 * exclusive copy, while a write invalidates every other copy so only one cache
 * may hold a dirty line. This module replays a fixed operation trace.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(F * C) for F operations snooping C caches
 *   Space: O(C) for the line states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One cell per cache shows its MESI letter for the watched line.
 *   - The cache that issued the request is highlighted; invalidated ones turn red.
 *   - meta carries the bus action and the full state vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type MesiState = "M" | "E" | "S" | "I";
type OperationKind = "read" | "write";

interface Operation {
    cache: number;
    op: OperationKind;
}

/** Apply one processor request and return the new state vector plus bus action. */
export function transition(states: MesiState[], cache: number, op: OperationKind): { states: MesiState[]; bus: string } {
    const next = states.slice();
    const mine = next[cache] ?? "I";
    if (op === "read") {
        if (mine === "M" || mine === "E" || mine === "S") {
            return { states: next, bus: "none (local hit)" };
        }
        const othersHaveData = next.some((state, index) => index !== cache && state !== "I");
        let wroteBack = false;
        for (let i = 0; i < next.length; i += 1) {
            if (i === cache) {
                continue;
            }
            if (next[i] === "M") {
                next[i] = "S";
                wroteBack = true;
            } else if (next[i] === "E") {
                next[i] = "S";
            }
        }
        next[cache] = othersHaveData ? "S" : "E";
        return { states: next, bus: wroteBack ? "BusRd + writeback" : "BusRd" };
    }
    if (mine === "M" || mine === "E") {
        next[cache] = "M";
        return { states: next, bus: "none (local hit)" };
    }
    for (let i = 0; i < next.length; i += 1) {
        if (i !== cache) {
            next[i] = "I";
        }
    }
    next[cache] = "M";
    return { states: next, bus: mine === "S" ? "BusUpgr" : "BusRdX" };
}

/** Build one cell per cache showing its MESI letter. */
function makeCells(states: MesiState[], active: number, invalidated: Set<number>): VisualEntity[] {
    return states.map((state, index) => {
        let visual: EntityState = "idle";
        if (invalidated.has(index)) {
            visual = "error";
        } else if (index === active) {
            visual = "comparing";
        } else if (state === "M" || state === "E") {
            visual = "active";
        } else if (state === "S") {
            visual = "visited";
        }
        return {
            id: `cache-${index}`,
            type: "cell" as const,
            label: `C${index}: ${state}`,
            value: state,
            state: visual,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, state },
        };
    });
}

/** The MESI generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { caches?: number; operations?: Operation[] } | null) ?? {};
    const cacheCount = Math.max(2, Math.min(8, Math.floor(task.caches ?? 3)));
    const operations: Operation[] = Array.isArray(task.operations) && task.operations.length > 0
        ? task.operations.map((item) => ({
              cache: ((Math.floor(item.cache) % cacheCount) + cacheCount) % cacheCount,
              op: item.op === "write" ? ("write" as const) : ("read" as const),
          }))
        : [
              { cache: 0, op: "read" },
              { cache: 1, op: "read" },
              { cache: 0, op: "write" },
              { cache: 2, op: "read" },
              { cache: 1, op: "read" },
              { cache: 2, op: "write" },
          ];

    let states: MesiState[] = Array.from({ length: cacheCount }, () => "I");
    yield {
        stepNumber: 0,
        entities: makeCells(states, -1, new Set()),
        edges: [],
        description: `MESI snooping across ${cacheCount} caches; all lines start invalid.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: cacheCount, states: states.slice(), bus: "init", invalidations: 0, step: 0 },
    };

    let step = 1;
    let invalidations = 0;
    for (const operation of operations) {
        const before = states.slice();
        const result = transition(states, operation.cache, operation.op);
        states = result.states;
        const invalidated = new Set<number>();
        for (let i = 0; i < before.length; i += 1) {
            if (before[i] !== "I" && states[i] === "I" && i !== operation.cache) {
                invalidated.add(i);
                invalidations += 1;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(states, operation.cache, invalidated),
            edges: [],
            description: `C${operation.cache} ${operation.op}: ${result.bus}; states ${states.join(" ")}.`,
            codeLineNumber: operation.op === "read" ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 1,
                cols: cacheCount,
                states: states.slice(),
                bus: result.bus,
                invalidations,
                step,
                request: `C${operation.cache}:${operation.op}`,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(states, -1, new Set()),
        edges: [],
        description: `Trace complete after ${operations.length} operation(s); ${invalidations} invalidation(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 1, cols: cacheCount, states: states.slice(), invalidations, done: true },
    };
}

/** The MESI module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Each cache keeps a small state tag for the memory line. A modified line is dirty and the only valid copy, an exclusive line is clean and unique, a shared line may have several clean copies, and an invalid line is unusable. When a processor writes, the bus forces every other copy to invalid so the write cannot be lost.",
        invariants: [
            "At most one cache holds a modified or exclusive copy at any time.",
            "If a line is modified somewhere, every other cache holds invalid.",
            "A shared copy is clean and agrees with memory and all other shared copies.",
        ],
        correctness:
            "The transition table covers every processor request in every state. A read of an invalid line issues a bus read; if another cache is modified it writes back and downgrades to shared, and if no other cache holds data the requester becomes exclusive. A write invalidates all other holders and sets the writer to modified, so there is never more than one writer. By induction over the trace, a read always returns the most recent value and the three invariants are preserved after each step.",
        complexityRationale:
            "Each request inspects and possibly updates all C cache tags, so a trace of F operations takes O(F times C) time. The state vector uses O(C) space.",
        uses: [
            "Snooping coherence in multicore processors",
            "Shared-memory multiprocessor cache controllers",
            "Teaching models for directory-based coherence protocols",
        ],
        references: [
            "Hennessy and Patterson, Computer Architecture: A Quantitative Approach, Chapter on Cache Coherence",
            "Papamarcos and Patel, A Low-Overhead Coherence Solution, 1984",
        ],
        workedExample:
            "With three caches, C0 reads first and becomes exclusive. C1 reads, so both become shared. C0 writes, upgrades to modified, and invalidates C1. C2 later reads, forcing C0 to write back to shared, and C2 becomes shared too. A final write by C2 leaves C2 modified and both others invalid.",
    },
    id: "cache-coherency-mesi",
    name: "MESI Cache Coherence",
    category: "production-systems",
    complexity: { time: "O(F * C)", space: "O(C)" },
    defaultInput: {
        caches: 3,
        operations: [
            { cache: 0, op: "read" },
            { cache: 1, op: "read" },
            { cache: 0, op: "write" },
            { cache: 2, op: "read" },
            { cache: 1, op: "read" },
            { cache: 2, op: "write" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start every cache line in the invalid state",
        "for each processor request in the trace",
        "on a read hit serve locally without bus traffic",
        "on a read miss snoop other caches and write back a modified line",
        "set the requester shared if others hold data, otherwise exclusive",
        "on a write invalidate all other holders and set the writer modified",
        "record the bus action and the resulting state vector",
        "done: report the final states and invalidation count",
    ],
};

export default module;
