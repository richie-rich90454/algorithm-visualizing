/**
 * compare-and-swap.ts - Compare-and-Swap Lock-Free Counter
 *
 * Compare-and-swap atomically writes a new value only when the memory still
 * equals an expected value. A lock-free counter uses it in a retry loop: read
 * the current value, compute the successor, then try to swap. If another
 * thread changed memory in between, the swap fails and the thread rereads.
 * Because a failed swap writes nothing, no increment is ever lost.
 *
 * This is a deterministic interleaving simulation with explicit read and swap
 * steps, a single integer cell, and atomic single-word operations. It does not
 * model memory reclamation, the ABA problem for pointers, cache contention, or
 * hardware memory-ordering rules.
 *
 * Time:  O(schedule length) for the simulated schedule
 * Space: O(threads) for the per-thread cached reads
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface CASInput {
    threads?: number;
    schedule?: Array<{ thread: number; action: string }>;
}

function makeEntities(memory: number, expected: number[], activeThread: number, final: boolean): VisualEntity[] {
    const values = [memory, ...expected];
    const labels = ["memory", ...expected.map((_, i) => `thread ${i} read`)];
    return values.map((value, index) => ({
        id: index === 0 ? "memory" : `thread-${index - 1}`,
        type: "bar" as const,
        label: `${labels[index]}: ${value}`,
        value,
        state: final ? "sorted" : index === activeThread + 1 ? "comparing" : index === 0 ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "memory" : "expected", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CASInput | null) ?? {};
    const threads = Math.min(8, Math.max(1, Math.floor(Number(task.threads ?? 3)) || 3));
    const schedule = Array.isArray(task.schedule) && task.schedule.length > 0
        ? task.schedule.slice(0, 60).map((item) => ({
              thread: Math.min(threads - 1, Math.max(0, Math.floor(Number(item?.thread) || 0))),
              action: item?.action === "cas" ? "cas" : "read",
          }))
        : [
              { thread: 0, action: "read" },
              { thread: 1, action: "read" },
              { thread: 0, action: "cas" },
              { thread: 1, action: "cas" },
              { thread: 1, action: "read" },
              { thread: 2, action: "read" },
              { thread: 1, action: "cas" },
              { thread: 2, action: "cas" },
              { thread: 2, action: "read" },
              { thread: 2, action: "cas" },
              { thread: 0, action: "read" },
              { thread: 0, action: "cas" },
          ];

    let memory = 0;
    const expected = Array.from({ length: threads }, () => 0);
    let successes = 0;
    let failures = 0;

    yield {
        stepNumber: 0,
        entities: makeEntities(memory, expected, -1, false),
        edges: [],
        description: `${threads} threads share one counter starting at zero; every increment is a compare-and-swap retry loop.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { threads, memory, expected: [...expected], successes, failures, action: "init", thread: -1, done: false },
    };

    let step = 1;
    for (let i = 0; i < schedule.length; i += 1) {
        const item = schedule[i]!;
        const thread = item.thread;
        let succeeded = false;
        if (item.action === "read") {
            expected[thread] = memory;
        } else {
            succeeded = expected[thread] === memory;
            if (succeeded) {
                memory += 1;
                successes += 1;
            } else {
                failures += 1;
            }
        }
        yield {
            stepNumber: step,
            entities: makeEntities(memory, expected, thread, i === schedule.length - 1),
            edges: [],
            description: item.action === "read"
                ? `Thread ${thread} reads the counter as ${memory} and will try to swap from that value.`
                : succeeded
                  ? `Thread ${thread} swaps ${expected[thread]} to ${memory}; the increment commits.`
                  : `Thread ${thread} sees a stale read of ${expected[thread]} versus memory ${memory}; the swap fails and it must retry.`,
            codeLineNumber: item.action === "read" ? 2 : succeeded ? 4 : 3,
            layout: "array",
            meta: {
                threads,
                memory,
                expected: [...expected],
                successes,
                failures,
                action: item.action,
                thread,
                succeeded,
                done: i === schedule.length - 1,
            },
        };
        step += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A lock protects a counter by serializing increments, but compare-and-swap can do it without a lock. Each thread reads the counter, computes the next value, and asks the hardware to write it only if nobody changed the cell since the read. If another thread won the race, the write is rejected and the loser simply reads again. No thread ever blocks on another, and a successful swap is exactly one committed increment.",
        invariants: [
            "A failed compare-and-swap leaves the memory cell unchanged.",
            "Every successful compare-and-swap increases the counter by exactly one.",
            "The counter always equals the number of successful swaps performed so far.",
        ],
        correctness:
            "The hardware guarantees that a compare-and-swap is atomic: it either observes the expected value and writes the successor, or observes a different value and writes nothing. In the first case the counter gains one and the calling thread has exclusive knowledge of the old value; in the second case no state changes, so no increment is lost. By induction over successful swaps the counter equals the number of committed increments, and since any failed swap is followed by a fresh read, every thread eventually commits under a fair schedule.",
        complexityRationale:
            "Each schedule step performs one read or one atomic swap, so the simulation takes time linear in the number of steps. Only the shared cell and one cached read per thread are stored, giving O(threads) space.",
        uses: [
            "Lock-free counters and statistics in concurrent runtimes",
            "Atomic stack and queue push operations",
            "Implementing higher-level synchronization primitives such as spinlocks",
        ],
        references: [
            "Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 4",
            "Michael and Scott, Simple, Fast, and Practical Non-Blocking Queue, 1996",
        ],
        workedExample:
            "Threads A and B both read a counter at zero. A swaps zero to one and succeeds. B's attempt compares its stale zero against memory one, so it fails and rereads one; its next swap from one to two succeeds. The final counter is two, exactly the two successful swaps.",
    },
    id: "compare-and-swap",
    name: "Compare-and-Swap",
    category: "parallel-distributed",
    complexity: { time: "O(schedule length)", space: "O(threads)" },
    defaultInput: {
        threads: 3,
        schedule: [
            { thread: 0, action: "read" },
            { thread: 1, action: "read" },
            { thread: 0, action: "cas" },
            { thread: 1, action: "cas" },
            { thread: 1, action: "read" },
            { thread: 2, action: "read" },
            { thread: 1, action: "cas" },
            { thread: 2, action: "cas" },
            { thread: 2, action: "read" },
            { thread: 2, action: "cas" },
            { thread: 0, action: "read" },
            { thread: 0, action: "cas" },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "start the shared counter at zero and each cached read at zero",
        "for each scheduled thread step",
        "on a read, store the current counter in the thread's expected slot",
        "on a swap, compare the expected slot with the counter",
        "if they match, write expected plus one and count a success",
        "otherwise write nothing and count a failure",
        "a failed thread rereads before trying again",
        "done: the counter equals the number of successful swaps",
    ],
};

export default module;
