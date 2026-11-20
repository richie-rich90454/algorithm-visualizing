/**
 * write-through-cache.ts - Write-Through Cache
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A write-through cache sends every store straight to main memory as well as
 * to the cached copy. That makes memory always consistent with the cache and
 * removes the need for a dirty bit or a flush, at the price of more memory
 * traffic on write-heavy code. On a miss a write may either allocate a line
 * (write allocate) or bypass the cache entirely (write around).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(1) per access in a direct-mapped cache
 *   Space: O(sets + addresses)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Upper grid rows are cache slots; lower rows are main-memory cells.
 *   - A hit is green, a miss amber, and a freshly written line is blue.
 *   - meta carries the hit verdict, memory snapshot, and counters.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface CacheSlot {
    tag: number;
    value: number;
    valid: boolean;
}

export interface CacheState {
    slots: CacheSlot[];
    memory: Record<number, number>;
}

export interface AccessResult {
    hit: boolean;
    wroteThrough: boolean;
    allocated: boolean;
    state: CacheState;
}

/** Apply one read or write to a direct-mapped write-through cache. */
export function access(
    state: CacheState,
    address: number,
    value: number,
    isWrite: boolean,
    sets: number,
    writeAllocate: boolean,
): AccessResult {
    const slots = state.slots.map((slot) => ({ ...slot }));
    const memory = { ...state.memory };
    const index = ((address % sets) + sets) % sets;
    const tag = Math.floor(address / sets);
    const slot = slots[index]!;
    const hit = slot.valid && slot.tag === tag;
    let allocated = false;
    let wroteThrough = false;
    if (isWrite) {
        memory[address] = value;
        wroteThrough = true;
        if (hit || writeAllocate) {
            slot.valid = true;
            slot.tag = tag;
            slot.value = value;
            allocated = !hit;
        }
    } else if (hit) {
        // The cached value already equals memory in a write-through design.
    } else {
        slot.valid = true;
        slot.tag = tag;
        slot.value = memory[address] ?? 0;
        allocated = true;
    }
    return { hit, wroteThrough, allocated, state: { slots, memory } };
}

function makeCells(state: CacheState, sets: number, addresses: number[], highlight: number, hit: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    state.slots.forEach((slot, index) => {
        entities.push({
            id: `cache-${index}`,
            type: "cell" as const,
            label: `S${index}:${slot.valid ? `T${slot.tag}=${slot.value}` : "empty"}`,
            value: slot.valid ? slot.value : -1,
            state: (index === highlight ? (hit ? "sorted" : "comparing") : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: index, col: 0, kind: "cache", tag: slot.tag, valid: slot.valid ? 1 : 0 },
        });
    });
    addresses.forEach((address, offset) => {
        entities.push({
            id: `mem-${address}`,
            type: "cell" as const,
            label: `M${address}:${state.memory[address] ?? 0}`,
            value: state.memory[address] ?? 0,
            state: (offset === highlight ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: sets + offset, col: 0, kind: "memory", address },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        sets?: number;
        addresses?: number[];
        ops?: Array<{ op: "read" | "write"; address: number; value?: number }>;
        writeAllocate?: boolean;
    } | null) ?? {};
    const sets = Math.max(1, Math.floor(Number(task.sets ?? 4)) || 4);
    const addresses = Array.isArray(task.addresses) && task.addresses.length > 0
        ? task.addresses.map((a) => Math.max(0, Math.floor(Number(a) || 0)))
        : [0, 1, 2, 3, 4, 5, 6, 7];
    const writeAllocate = task.writeAllocate !== false;
    const ops = Array.isArray(task.ops) && task.ops.length > 0
        ? task.ops
        : [
            { op: "read" as const, address: 0 },
            { op: "write" as const, address: 1, value: 11 },
            { op: "read" as const, address: 1 },
            { op: "write" as const, address: 5, value: 55 },
            { op: "read" as const, address: 5 },
            { op: "read" as const, address: 0 },
        ];

    let state: CacheState = {
        slots: Array.from({ length: sets }, () => ({ tag: -1, value: 0, valid: false })),
        memory: Object.fromEntries(addresses.map((a) => [a, a])),
    };
    let hits = 0;
    let misses = 0;
    let memoryWrites = 0;
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeCells(state, sets, addresses, -1, false),
        edges: [],
        description: `Write-through cache with ${sets} direct-mapped slot(s), write allocate ${writeAllocate ? "on" : "off"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { hits: 0, misses: 0, memoryWrites: 0, tags: [], values: [], memory: addresses.map((a) => a) },
    };
    stepNumber += 1;

    for (let i = 0; i < ops.length; i += 1) {
        const op = ops[i]!;
        const isWrite = op.op === "write";
        const result = access(state, op.address, op.value ?? 0, isWrite, sets, writeAllocate);
        state = result.state;
        if (result.hit) hits += 1;
        else misses += 1;
        if (result.wroteThrough) memoryWrites += 1;
        const index = ((op.address % sets) + sets) % sets;
        yield {
            stepNumber: stepNumber,
            entities: makeCells(state, sets, addresses, index, result.hit),
            edges: [],
            description: `Access ${i}: ${isWrite ? "write" : "read"} address ${op.address}, ${result.hit ? "hit" : "miss"}, through to memory ${result.wroteThrough}.`,
            codeLineNumber: isWrite ? (result.hit ? 3 : 4) : 2,
            layout: "grid",
            meta: {
                hits,
                misses,
                memoryWrites,
                tags: state.slots.map((slot) => slot.tag),
                values: state.slots.map((slot) => slot.value),
                memory: addresses.map((a) => state.memory[a] ?? 0),
                lastHit: result.hit ? 1 : 0,
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber: stepNumber,
        entities: makeCells(state, sets, addresses, -1, false),
        edges: [],
        description: `Finished with ${hits} hit(s), ${misses} miss(es), and ${memoryWrites} memory write(s); memory always matches the writes.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            hits,
            misses,
            memoryWrites,
            tags: state.slots.map((slot) => slot.tag),
            values: state.slots.map((slot) => slot.value),
            memory: addresses.map((a) => state.memory[a] ?? 0),
            finalMemory: addresses.map((a) => state.memory[a] ?? 0),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "On every store, write the new value both into the cache line and into main memory immediately. Because memory is updated at the same moment, there is never a dirty line to flush and a second core always sees the latest value. A read that misses fetches from memory into the chosen direct-mapped slot; a write that misses may either allocate that slot or simply bypass the cache.",
        invariants: [
            "After any write, main memory at that address equals the written value.",
            "A cached line always has the same value as its memory address.",
            "The slot index of an address is address modulo the number of sets.",
        ],
        correctness:
            "The write path performs both updates in one step, so by induction over accesses every cached value agrees with memory. On a read hit the cached value is therefore correct, and on a read miss loading from memory installs the correct value. Write allocate only changes which addresses are cached, never the values, so both policies preserve memory consistency.",
        complexityRationale:
            "A direct-mapped lookup computes one modulo and compares one tag, so each access is constant time and the whole trace is linear in its length. Slots plus the memory snapshot use space proportional to the number of sets and addresses.",
        uses: [
            "Systems that require memory and cache to stay consistent",
            "Simple CPU and GPU write policies",
            "Teaching the trade-off between write-through and write-back",
        ],
        references: [
            "Hennessy and Patterson, Computer Architecture: A Quantitative Approach, Chapter 5",
            "Hamacher, Vranesic, and Zaky, Computer Organization, Chapter 5",
        ],
        workedExample:
            "With four sets, address 5 maps to slot 1 with tag 1. Writing 55 to address 5 stores 55 in memory and, with write allocate on, also places tag 1 with value 55 in slot 1. A later read of address 5 hits that slot; a read of address 1 also maps to slot 1 but misses because its tag is 0, so the line is replaced with the value from memory.",
    },
    id: "write-through-cache",
    name: "Write-Through Cache",
    category: "production-systems",
    complexity: { time: "O(1) per access", space: "O(sets + addresses)" },
    defaultInput: {
        sets: 4,
        addresses: [0, 1, 2, 3, 4, 5, 6, 7],
        writeAllocate: true,
        ops: [
            { op: "read", address: 0 },
            { op: "write", address: 1, value: 11 },
            { op: "read", address: 1 },
            { op: "write", address: 5, value: 55 },
            { op: "read", address: 5 },
            { op: "read", address: 0 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize all cache slots as invalid and memory with starting values",
        "for each access compute the slot index and tag",
        "on a read hit return the cached value",
        "on a read miss load the memory value into the slot",
        "on a write update main memory immediately",
        "update or allocate the cache slot when the policy allows",
        "record the hit verdict and the memory snapshot",
        "done: report hit, miss and memory-write counts",
    ],
};

export default module;
