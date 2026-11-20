/**
 * msi-protocol.ts - MSI Cache Coherence Protocol
 *
 * Each cache line is in one of three states: Modified, Shared, or Invalid. A
 * read on an invalid line issues a bus read and becomes Shared, downgrading any
 * Modified copy to Shared. A write on a non-Modified line issues a bus upgrade
 * that invalidates every other copy, then becomes Modified.
 *
 * The simulation is deterministic: accesses arrive in a supplied order and all
 * bus transactions complete instantly. It does not model write buffers,
 * directory indirection, or the extra Exclusive and Owned states of MESI and
 * MOESI, which are separate modules.
 *
 * Time:  O(accesses * caches)
 * Space: O(caches * blocks)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Action = "read" | "write";
type State = "M" | "S" | "I";

interface Access {
    cache: number;
    action: Action;
    block: number;
}

interface Task {
    caches?: number;
    blocks?: number;
    accesses?: Access[];
}

function makeCells(states: State[][], caches: number, blocks: number): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let c = 0; c < caches; c += 1) {
        for (let b = 0; b < blocks; b += 1) {
            const state = states[c]?.[b] ?? "I";
            const index = c * blocks + b;
            cells.push({
                id: `cell-${index}`,
                type: "cell" as const,
                label: `C${c}B${b}:${state}`,
                value: state,
                state: state === "M" ? "error" : state === "S" ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: c, col: b, index, cache: c, block: b, coherence: state },
            });
        }
    }
    return cells;
}

/** Check the MSI invariant on one block: at most one writer and no shared writers. */
function blockValid(states: State[][], b: number, caches: number): boolean {
    let modified = 0;
    let shared = 0;
    for (let c = 0; c < caches; c += 1) {
        const s = states[c]?.[b] ?? "I";
        if (s === "M") modified += 1;
        if (s === "S") shared += 1;
    }
    return modified <= 1 && (modified === 0 || shared === 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const caches = Math.min(8, Math.max(2, Math.floor(Number(task.caches ?? 3)) || 3));
    const blocks = Math.min(8, Math.max(1, Math.floor(Number(task.blocks ?? 1)) || 1));
    const accesses: Access[] = Array.isArray(task.accesses) ? task.accesses.slice() : [
        { cache: 0, action: "read", block: 0 },
        { cache: 1, action: "read", block: 0 },
        { cache: 2, action: "write", block: 0 },
        { cache: 0, action: "read", block: 0 },
        { cache: 1, action: "read", block: 0 },
    ];
    const states: State[][] = Array.from({ length: caches }, () => new Array<State>(blocks).fill("I"));

    yield {
        stepNumber: 0,
        entities: makeCells(states, caches, blocks),
        edges: [],
        description: `${caches} caches start with every line Invalid under the MSI coherence protocol.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { caches, blocks, access: null, action: "", busTransactions: 0, invariantHolds: true },
    };

    let step = 1;
    let busTransactions = 0;
    let allValid = true;
    for (const access of accesses) {
        const c = Math.max(0, Math.min(caches - 1, Math.floor(Number(access.cache)) || 0));
        const b = Math.max(0, Math.min(blocks - 1, Math.floor(Number(access.block)) || 0));
        const action: Action = access.action === "write" ? "write" : "read";
        const current = states[c]?.[b] ?? "I";
        let transaction = "none";

        if (action === "read") {
            if (current === "I") {
                transaction = "bus read";
                busTransactions += 1;
                for (let other = 0; other < caches; other += 1) {
                    if (other === c) continue;
                    if (states[other]?.[b] === "M") {
                        (states[other] as State[])[b] = "S";
                    }
                }
                (states[c] as State[])[b] = "S";
            }
        } else if (current !== "M") {
            transaction = current === "S" ? "bus upgrade" : "bus read exclusive";
            busTransactions += 1;
            for (let other = 0; other < caches; other += 1) {
                if (other !== c) {
                    (states[other] as State[])[b] = "I";
                }
            }
            (states[c] as State[])[b] = "M";
        }

        let valid = true;
        for (let blk = 0; blk < blocks; blk += 1) {
            if (!blockValid(states, blk, caches)) valid = false;
        }
        allValid = allValid && valid;

        yield {
            stepNumber: step,
            entities: makeCells(states, caches, blocks),
            edges: [],
            description: `Cache ${c} ${action}s block ${b} (was ${current}); transaction ${transaction}; line now ${states[c]?.[b]}.`,
            codeLineNumber: action === "read" ? 2 : 4,
            layout: "grid",
            meta: { caches, blocks, access: { cache: c, action, block: b }, action, transaction, busTransactions, invariantHolds: valid, states: states.map((row) => [...row]) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(states, caches, blocks),
        edges: [],
        description: `Processed ${accesses.length} accesses with ${busTransactions} bus transaction(s); MSI invariant ${allValid ? "holds" : "was violated"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { caches, blocks, accesses: accesses.length, busTransactions, invariantHolds: allValid, states: states.map((row) => [...row]) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cache line is Modified when one cache owns the only valid, dirty copy, Shared when several caches hold a clean copy, and Invalid when a cache has no usable copy. Reads fetch a shared copy; writes first invalidate everyone else so exactly one cache may hold the modified line. Those three states are enough to guarantee that no two caches disagree about the value of a block.",
        invariants: [
            "At most one cache can hold a block in the Modified state.",
            "No cache holds Shared while another holds Modified for the same block.",
            "A local hit produces no bus transaction.",
        ],
        correctness:
            "On a read miss the bus read forces every Modified copy to downgrade to Shared before the requester becomes Shared, so a single writer can never coexist with new readers. On a write the bus transaction invalidates all other copies before the requester becomes Modified, so at most one writer exists. The property check examines every block after every access and confirms those two conditions, and the test compares the final state of a scripted access sequence against a hand-computed outcome.",
        complexityRationale:
            "Each access scans at most all caches for one block, giving O(caches) time per access and O(accesses times caches) overall. The state matrix occupies O(caches times blocks) space.",
        uses: [
            "Modeling snooping coherence in shared-memory multiprocessors",
            "Teaching the simplest write-invalidate cache protocol",
            "A baseline before studying MESI and directory-based schemes",
        ],
        references: [
            "Censier and Feautrier, A New Solution to Coherence Problems, 1978",
            "Hennessy and Patterson, Computer Architecture, Chapter 5",
        ],
        workedExample:
            "With three caches and one block, cache 0 reads and becomes Shared, cache 1 reads and also becomes Shared. Cache 2 writes, invalidating both, and becomes Modified. When cache 0 reads again, cache 2 downgrades to Shared and cache 0 becomes Shared, leaving all three caches Shared with zero Modified copies.",
    },
    id: "msi-protocol",
    name: "MSI Cache Coherence Protocol",
    category: "parallel-distributed",
    complexity: { time: "O(accesses * caches)", space: "O(caches * blocks)" },
    defaultInput: {
        caches: 3,
        blocks: 1,
        accesses: [
            { cache: 0, action: "read", block: 0 },
            { cache: 1, action: "read", block: 0 },
            { cache: 2, action: "write", block: 0 },
            { cache: 0, action: "read", block: 0 },
            { cache: 1, action: "read", block: 0 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize every cache line to Invalid",
        "for each access determine the cache, block, and operation",
        "if reading an invalid line issue a bus read and downgrade Modified copies",
        "mark the requester Shared",
        "if writing a non Modified line invalidate all other copies",
        "mark the requester Modified",
        "check the coherence invariant after the access",
        "done: report the final states and transaction count",
    ],
};

export default module;
