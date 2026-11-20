/**
 * cache-coherency-moesi.ts - MOESI Cache Coherency Protocol
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MOESI is a write-back cache coherency protocol with five states: Modified,
 * Owned, Exclusive, Shared and Invalid. It extends MESI with Owned, which lets
 * one cache hold a dirty line and supply it to others without an immediate
 * memory write-back. This reduces memory traffic on shared read-mostly data.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * c) for n operations and c caches
 *   Space: O(n * c) for the recorded state trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per cache shows its current coherency state letter.
 *   - The acting cache is highlighted; dirty states are green.
 *   - meta carries the state trace and bus transactions for checking.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type CohState = "M" | "O" | "E" | "S" | "I";
type Action = "read" | "write";

interface Operation {
    cache: number;
    action: Action;
}

const STATE_CODE: Record<CohState, number> = { M: 0, O: 1, E: 2, S: 3, I: 4 };

/** Build one cell per cache showing its coherency state. */
function makeCells(states: CohState[], acting: number, traces: string[]): VisualEntity[] {
    return states.map((state, index) => {
        let visual: EntityState = "idle";
        if (state === "M" || state === "O" || state === "E") {
            visual = "sorted";
        } else if (state === "I") {
            visual = "unvisited";
        }
        if (index === acting) {
            visual = "comparing";
        }
        return {
            id: `cache-${index}`,
            type: "cell" as const,
            label: state,
            value: STATE_CODE[state],
            state: visual,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, state, cache: index, trace: traces[index] ?? "" },
        };
    });
}

/** Apply one local operation, returning the new states and the bus transaction. */
function stepStates(states: CohState[], cache: number, action: Action): { states: CohState[]; bus: string } {
    const next = [...states];
    const mine = next[cache] ?? "I";
    const others = states.map((s, i) => ({ state: s, index: i })).filter((x) => x.index !== cache);
    const hasValidOther = others.some((x) => x.state !== "I");
    let bus = "None";

    if (action === "read") {
        bus = "BusRd";
        if (mine === "I") {
            next[cache] = hasValidOther ? "S" : "E";
        }
        for (const other of others) {
            if (other.state === "M") {
                next[other.index] = "O";
            } else if (other.state === "E") {
                next[other.index] = "S";
            }
        }
    } else {
        if (mine === "M" || mine === "E") {
            bus = "None";
        } else if (mine === "O") {
            bus = others.some((x) => x.state === "S" || x.state === "O") ? "BusUpgr" : "None";
        } else {
            bus = mine === "S" ? "BusUpgr" : "BusRdX";
        }
        next[cache] = "M";
        for (const other of others) {
            if (bus === "BusRdX") {
                next[other.index] = "I";
            } else if (bus === "BusUpgr" && (other.state === "S" || other.state === "O")) {
                next[other.index] = "I";
            }
        }
    }
    return { states: next, bus };
}

/** Simulate MOESI state transitions. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { cacheCount?: number; operations?: Operation[] } | null) ?? {};
    const cacheCount = Math.min(8, Math.max(2, Math.floor(Number(task.cacheCount ?? 4)) || 4));
    const operations: Operation[] = task.operations ?? [
        { cache: 0, action: "read" },
        { cache: 1, action: "read" },
        { cache: 0, action: "write" },
        { cache: 2, action: "read" },
        { cache: 1, action: "write" },
        { cache: 3, action: "read" },
    ];

    let states: CohState[] = Array.from({ length: cacheCount }, () => "I");
    const traces: string[] = Array.from({ length: cacheCount }, () => "-");
    const traceSeries: string[] = [];
    const busSeries: string[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(states, -1, traces),
        edges: [],
        description: `${cacheCount} caches begin in the Invalid state before ${operations.length} operation(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { cols: cacheCount, trace: [states.join("")], bus: [], finalStates: states.join("") },
    };
    step += 1;

    for (let i = 0; i < operations.length; i += 1) {
        const operation = operations[i];
        if (!operation) {
            continue;
        }
        const cache = ((Math.floor(Number(operation.cache)) % cacheCount) + cacheCount) % cacheCount;
        const action: Action = operation.action === "write" ? "write" : "read";
        const result = stepStates(states, cache, action);
        states = result.states;
        traces[cache] = `${action}/${result.bus}`;
        traceSeries.push(states.join(""));
        busSeries.push(result.bus);

        yield {
            stepNumber: step,
            entities: makeCells(states, cache, traces),
            edges: [],
            description: `Cache ${cache} ${action}: bus ${result.bus}; states ${states.join(" ")}.`,
            codeLineNumber: action === "read" ? 3 : 5,
            layout: "grid",
            meta: {
                cols: cacheCount,
                trace: [...traceSeries],
                bus: [...busSeries],
                finalStates: states.join(""),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(states, -1, traces),
        edges: [],
        description: `MOESI finished in states ${states.join(" ")} after ${operations.length} operation(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            cols: cacheCount,
            trace: [...traceSeries],
            bus: [...busSeries],
            finalStates: states.join(""),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each cache keeps a letter describing its copy of a memory line. A read either gets an exclusive clean copy or joins other readers in Shared; a write invalidates everyone else. Owned is the extra state: one cache can keep a dirty copy and hand data to readers without writing to memory first.",
        invariants: [
            "At most one cache is Modified and at most one cache is Owned at any time.",
            "A Modified or Exclusive line is exclusive: no other cache holds a valid copy.",
            "Only a write can move a cache into Modified; only a remote read can move Modified into Owned.",
        ],
        correctness:
            "Every bus transaction preserves single-writer, multiple-reader coherence. BusRd downgrades a Modified supplier to Owned and a clean Exclusive to Shared; BusRdX invalidates all other copies before the writer becomes Modified; BusUpgr invalidates shared readers without fetching data. Because exactly one cache may hold a writable copy and the Owned supplier is unique, all caches observe a consistent value.",
        complexityRationale:
            "Each operation scans the c caches to classify other copies and update them, taking O(c) time for n operations. The trace stores one state string of length c per operation, so space is O(n * c).",
        uses: [
            "Shared-memory multiprocessor cache controllers",
            "AMD Opteron and related coherent interconnects",
            "Directory-based coherence protocols with an owner node",
        ],
        references: [
            "Sweazey and Smith, A Comparison of Multiprocessor Cache Coherence Protocols, 1986",
            "Hennessy and Patterson, Computer Architecture: A Quantitative Approach, Chapter 5",
        ],
        workedExample:
            "Cache 0 reads an absent line and gets Exclusive. Cache 1 reads, so cache 0 drops to Shared and cache 1 becomes Shared. Cache 0 writes with BusUpgr, invalidating cache 1 and becoming Modified. A later read by cache 2 turns cache 0 into Owned and cache 2 into Shared, avoiding a memory write-back.",
    },
    id: "cache-coherency-moesi",
    name: "MOESI Cache Coherency",
    category: "production-systems",
    complexity: { time: "O(n * c)", space: "O(n * c)" },
    defaultInput: {
        cacheCount: 4,
        operations: [
            { cache: 0, action: "read" },
            { cache: 1, action: "read" },
            { cache: 0, action: "write" },
            { cache: 2, action: "read" },
            { cache: 1, action: "write" },
            { cache: 3, action: "read" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every cache to the Invalid state",
        "for each local read or write operation",
        "on a read, use BusRd and give Invalid caches Exclusive or Shared",
        "on a read, downgrade a Modified supplier to Owned and Exclusive to Shared",
        "on a write, upgrade Shared to Modified with BusUpgr or fetch with BusRdX",
        "invalidate all other copies when a write becomes Modified",
        "record the states and bus transaction for this operation",
        "after all operations, report the final state of every cache",
    ],
};

export default module;
