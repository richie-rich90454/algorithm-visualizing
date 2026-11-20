/**
 * test-and-set.ts - Test-and-Set Based Mutual Exclusion
 *
 * A test-and-set register atomically reads a boolean and writes true. A process
 * that reads false has acquired the lock, because every later call sees true
 * until the lock is released. This module explores every possible ordering of
 * n processes racing for the register and verifies that exactly one wins in
 * each interleaving.
 *
 * This is an exact small simulation: it enumerates all n factorial orders for
 * n at most four. Limits: no release phase is modeled, processes are scheduled
 * one atomic operation at a time, and the register starts unlocked.
 *
 * Time: O(n factorial * n). Space: O(n) per interleaving.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function makeCells(
    locked: boolean,
    reads: Array<boolean | null>,
    winner: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = reads.map((read, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `P${index}:${read === null ? "wait" : read ? "true" : "false"}`,
        value: read === null ? -1 : read ? 1 : 0,
        state: index === winner ? ("sorted" as const) : (read === null ? ("idle" as const) : ("visited" as const)),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, read: read === null ? -1 : read ? 1 : 0, row: 0, col: index },
    }));
    entities.push({
        id: "cell-register",
        type: "cell" as const,
        label: `register=${locked ? "true" : "false"}`,
        value: locked ? 1 : 0,
        state: locked ? ("active" as const) : ("idle" as const),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: -1, register: locked, row: 1, col: 0 },
    });
    return entities;
}

/** Produce every permutation of the integers 0 through n-1. */
function permutations(n: number): number[][] {
    const result: number[][] = [];
    const used = new Array<boolean>(n).fill(false);
    const current: number[] = [];
    const visit = () => {
        if (current.length === n) {
            result.push(current.slice());
            return;
        }
        for (let i = 0; i < n; i += 1) {
            if (used[i]) {
                continue;
            }
            used[i] = true;
            current.push(i);
            visit();
            current.pop();
            used[i] = false;
        }
    };
    visit();
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: number } | null) ?? {};
    const n = Math.max(1, Math.min(4, Math.floor(Number(task.processes ?? 3)) || 3));
    const orders = permutations(n);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(false, new Array<boolean | null>(n).fill(null), null),
        edges: [],
        description: `Explore all ${orders.length} interleavings of ${n} processes on a test-and-set register.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, interleavings: orders.length },
    };
    step += 1;

    for (let o = 0; o < orders.length; o += 1) {
        const order = orders[o] as number[];
        let locked = false;
        const reads: Array<boolean | null> = new Array<boolean | null>(n).fill(null);
        let winner: number | null = null;
        for (const p of order) {
            const old = locked;
            locked = true;
            reads[p] = old;
            if (!old) {
                winner = p;
            }
            yield {
                stepNumber: step,
                entities: makeCells(locked, reads, winner),
                edges: [],
                description: `Order ${o + 1}: process ${p} read ${old ? "true" : "false"} and ${old ? "lost" : "acquired"} the lock.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: {
                    interleaving: o + 1,
                    order: order.slice(),
                    actor: p,
                    oldValue: old,
                    locked,
                    winner,
                },
            };
            step += 1;
        }
    }

    // Verify mutual exclusion over every explored interleaving.
    let allSingleWinner = true;
    for (const order of orders) {
        let locked = false;
        let winners = 0;
        for (const _p of order) {
            const old = locked;
            locked = true;
            if (!old) {
                winners += 1;
            }
        }
        if (winners !== 1) {
            allSingleWinner = false;
        }
    }
    const finalReads: Array<boolean | null> = new Array<boolean | null>(n).fill(null);
    yield {
        stepNumber: step,
        entities: makeCells(true, finalReads, null),
        edges: [],
        description: `All ${orders.length} interleavings produced exactly one lock owner: ${allSingleWinner}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            n,
            interleavings: orders.length,
            mutualExclusion: allSingleWinner,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A test-and-set instruction reads a shared flag and sets it in one indivisible step. The first process to execute it sees false and claims the lock; everyone after it sees true and waits. Because the read and write cannot be split, no two processes can both see false, which is exactly the mutual-exclusion guarantee.",
        invariants: [
            "The register starts false and becomes true after the first successful call.",
            "Exactly one process reads false in any complete race.",
            "Once true, the register stays true because no release is modeled.",
        ],
        correctness:
            "Atomicity means each call observes the register value left by the previous call in the interleaving. The first call in any ordering sees false and sets true; every subsequent call sees true. Therefore precisely one process acquires the lock in each ordering. The simulator enumerates all n factorial orderings and checks that the winner count is one in every case, which is a brute-force proof of mutual exclusion for the modeled system.",
        complexityRationale:
            "There are n factorial orderings and each simulation touches n processes, so the exhaustive check costs O(n factorial times n) time; each ordering keeps O(n) state.",
        uses: [
            "Implementing spinlocks in operating systems",
            "Low-level synchronization in runtime libraries",
            "Building more elaborate locks such as test-and-test-and-set",
        ],
        references: [
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 7",
            "Lamport, A New Solution of Dijkstra's Concurrent Programming Problem, 1974",
        ],
        workedExample:
            "With processes 0, 1 and 2 racing in order 1, 0, 2, process 1 reads false and sets the register true. Processes 0 and 2 then read true, so process 1 is the unique winner, and the same holds for the other five orderings.",
    },
    id: "test-and-set",
    name: "Test-and-Set Lock",
    category: "parallel-distributed",
    complexity: { time: "O(n! * n)", space: "O(n)" },
    defaultInput: { processes: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the number of competing processes",
        "enumerate every ordering of the processes",
        "start with the register unlocked",
        "for each process in the ordering call test and set",
        "record the old value and mark a process that read false as winner",
        "count winners in this interleaving",
        "confirm every interleaving has exactly one winner",
    ],
};

export default module;
