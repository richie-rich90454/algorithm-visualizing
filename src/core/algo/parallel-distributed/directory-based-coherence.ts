/**
 * directory-based-coherence.ts - Directory-Based MSI Cache Coherence
 *
 * A directory keeps, for every memory line, the current owner (when the line
 * is modified) or the set of sharers (when it is clean). On a read the line
 * is supplied by memory or by the owner, which first writes back. On a write
 * all other copies are invalidated and the writer becomes the sole owner.
 * This simulation checks the MSI coherence invariant after every access.
 *
 * Limit: small fixed sets of processes and addresses, write-back policy.
 *
 * Time:  O(sharers) per access
 * Space: O(processes * addresses)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type DirState = "unshared" | "shared" | "modified";
type CacheState = "I" | "S" | "M";

interface Access {
    proc: number;
    op: "read" | "write";
    addr: string;
    value?: number;
}

interface DirectoryEntry {
    state: DirState;
    owner: number | null;
    sharers: number[];
}

interface Machine {
    memory: Record<string, number>;
    directory: Record<string, DirectoryEntry>;
    caches: Record<string, Record<string, { state: CacheState; value: number }>>;
}

function createMachine(procs: number, addresses: string[]): Machine {
    const memory: Record<string, number> = {};
    const directory: Record<string, DirectoryEntry> = {};
    const caches: Record<string, Record<string, { state: CacheState; value: number }>> = {};
    for (const addr of addresses) {
        memory[addr] = 0;
        directory[addr] = { state: "unshared", owner: null, sharers: [] };
    }
    for (let p = 0; p < procs; p += 1) {
        caches[String(p)] = {};
        for (const addr of addresses) caches[String(p)]![addr] = { state: "I", value: 0 };
    }
    return { memory, directory, caches };
}

function applyAccess(machine: Machine, procs: number, access: Access): void {
    const { proc, op, addr } = access;
    const entry = machine.directory[addr];
    const cache = machine.caches[String(proc)];
    if (!entry || !cache) return;
    const line = cache[addr]!;

    if (op === "read") {
        if (entry.state === "modified" && entry.owner !== null) {
            const ownerLine = machine.caches[String(entry.owner)]?.[addr];
            if (ownerLine) {
                machine.memory[addr] = ownerLine.value;
                ownerLine.state = "S";
                entry.sharers.push(entry.owner);
            }
            entry.owner = null;
            entry.state = "shared";
        }
        if (entry.state === "unshared") entry.state = "shared";
        if (!entry.sharers.includes(proc)) entry.sharers.push(proc);
        line.state = "S";
        line.value = machine.memory[addr] ?? 0;
        return;
    }

    if (entry.state === "modified" && entry.owner !== null && entry.owner !== proc) {
        const ownerLine = machine.caches[String(entry.owner)]?.[addr];
        if (ownerLine) {
            machine.memory[addr] = ownerLine.value;
            ownerLine.state = "I";
        }
        entry.owner = null;
    }
    for (const sharer of entry.sharers) {
        if (sharer !== proc) {
            const other = machine.caches[String(sharer)]?.[addr];
            if (other) other.state = "I";
        }
    }
    entry.sharers = [];
    entry.owner = proc;
    entry.state = "modified";
    line.state = "M";
    line.value = access.value ?? line.value;
    void procs;
}

function invariant(machine: Machine, procs: number, addresses: string[]): boolean {
    for (const addr of addresses) {
        const entry = machine.directory[addr]!;
        const modifiedOwners: number[] = [];
        const sharersWithValidCopy: number[] = [];
        for (let p = 0; p < procs; p += 1) {
            const line = machine.caches[String(p)]?.[addr];
            if (!line) continue;
            if (line.state === "M") modifiedOwners.push(p);
            if (line.state === "S") sharersWithValidCopy.push(p);
            if (line.state === "S" && line.value !== machine.memory[addr]) return false;
        }
        if (entry.state === "modified") {
            if (entry.owner === null || modifiedOwners.length !== 1 || modifiedOwners[0] !== entry.owner) return false;
            if (sharersWithValidCopy.length !== 0 || entry.sharers.length !== 0) return false;
        } else if (entry.state === "shared") {
            if (modifiedOwners.length !== 0) return false;
            const sortedSharers = [...entry.sharers].sort((a, b) => a - b);
            const sortedValid = [...sharersWithValidCopy].sort((a, b) => a - b);
            if (sortedSharers.length !== sortedValid.length) return false;
            for (let i = 0; i < sortedSharers.length; i += 1) {
                if (sortedSharers[i] !== sortedValid[i]) return false;
            }
        } else {
            if (modifiedOwners.length !== 0 || sharersWithValidCopy.length !== 0) return false;
        }
    }
    return true;
}

function coherentView(machine: Machine, addresses: string[]): Record<string, number> {
    const view: Record<string, number> = {};
    for (const addr of addresses) {
        const entry = machine.directory[addr]!;
        if (entry.state === "modified" && entry.owner !== null) {
            view[addr] = machine.caches[String(entry.owner)]?.[addr]?.value ?? machine.memory[addr] ?? 0;
        } else {
            view[addr] = machine.memory[addr] ?? 0;
        }
    }
    return view;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { procs?: number; addresses?: string[]; accesses?: Access[] } | null) ?? {};
    const procs = typeof task.procs === "number" ? Math.max(1, task.procs) : 3;
    const addresses = task.addresses ?? ["A", "B"];
    const accesses: Access[] = task.accesses ?? [
        { proc: 0, op: "read", addr: "A" },
        { proc: 1, op: "read", addr: "A" },
        { proc: 0, op: "write", addr: "A", value: 7 },
        { proc: 1, op: "read", addr: "A" },
        { proc: 2, op: "write", addr: "B", value: 4 },
    ];

    const machine = createMachine(procs, addresses);

    const makeEntities = (): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        let row = 0;
        for (const addr of addresses) {
            const entry = machine.directory[addr]!;
            entities.push({
                id: `mem-${addr}`,
                type: "cell",
                label: `mem[${addr}]=${machine.memory[addr] ?? 0}`,
                value: machine.memory[addr] ?? 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col: 0, addr, kind: "memory" },
            });
            entities.push({
                id: `dir-${addr}`,
                type: "cell",
                label: `dir[${addr}]=${entry.state}${entry.owner !== null ? `:P${entry.owner}` : ""}`,
                value: entry.state,
                state: "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col: 1, addr, kind: "directory" },
            });
            row += 1;
        }
        for (let p = 0; p < procs; p += 1) {
            for (const addr of addresses) {
                const line = machine.caches[String(p)]![addr]!;
                entities.push({
                    id: `cache-${p}-${addr}`,
                    type: "cell",
                    label: `P${p}[${addr}]=${line.state}:${line.value}`,
                    value: line.value,
                    state: line.state === "M" ? "swapped" : line.state === "S" ? "sorted" : "unvisited",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col: p, addr, proc: p, kind: "cache" },
                });
            }
            row += 1;
        }
        return entities;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(),
        edges: [],
        description: `Initial state: ${procs} processor(s), ${addresses.length} memory line(s), all caches invalid and directory unshared.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: addresses.length + procs, cols: Math.max(2, procs), valid: invariant(machine, procs, addresses), view: coherentView(machine, addresses) },
    };
    step += 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const access = accesses[i]!;
        applyAccess(machine, procs, access);
        const valid = invariant(machine, procs, addresses);
        yield {
            stepNumber: step,
            entities: makeEntities(),
            edges: [],
            description: `Access ${i + 1}: processor ${access.proc} ${access.op}s ${access.addr}${access.op === "write" ? ` with value ${access.value ?? 0}` : ""}; coherence invariant ${valid ? "holds" : "is violated"}.`,
            codeLineNumber: access.op === "read" ? 3 : 6,
            layout: "grid",
            meta: {
                rows: addresses.length + procs,
                cols: Math.max(2, procs),
                access: i + 1,
                proc: access.proc,
                op: access.op,
                addr: access.addr,
                valid,
                memory: { ...machine.memory },
                view: coherentView(machine, addresses),
            },
        };
        step += 1;
    }

    const valid = invariant(machine, procs, addresses);
    yield {
        stepNumber: step,
        entities: makeEntities(),
        edges: [],
        description: `Directory coherence ${valid ? "preserved" : "broken"} across ${accesses.length} access(es).`,
        codeLineNumber: 8,
        layout: "grid",
        meta: { rows: addresses.length + procs, cols: Math.max(2, procs), valid, accesses: accesses.length, memory: { ...machine.memory }, view: coherentView(machine, addresses) },
    };
}

const module: AlgorithmModule = {
    id: "directory-based-coherence",
    name: "Directory-Based MSI Cache Coherence",
    category: "parallel-distributed",
    complexity: { time: "O(sharers) per access", space: "O(processes * addresses)" },
    defaultInput: {
        procs: 3,
        addresses: ["A", "B"],
        accesses: [
            { proc: 0, op: "read", addr: "A" },
            { proc: 1, op: "read", addr: "A" },
            { proc: 0, op: "write", addr: "A", value: 7 },
            { proc: 1, op: "read", addr: "A" },
            { proc: 2, op: "write", addr: "B", value: 4 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "keep memory values and a directory entry per line",
        "on a read, if the line is modified write back the owner and downgrade it",
        "mark the line shared and add the reader to the sharer set",
        "supply the value from memory to the requesting cache",
        "on a write, invalidate every other sharer of the line",
        "write back a remote owner and clear the sharer set",
        "make the writer the sole modified owner and store the new value",
        "check the MSI invariant after each access",
        "done: report whether coherence was preserved",
    ],
    education: {
        intuition:
            "A directory is a centralized map that remembers who holds each memory line. Instead of broadcasting every write to all caches, the directory tells exactly which processors must be invalidated. This scales better than snooping because traffic follows the sharers rather than the whole machine.",
        invariants: [
            "A modified line has exactly one owner and no other valid cached copy.",
            "A shared line has no owner and every sharer's cached value equals memory.",
            "An unshared line has no valid cached copy anywhere.",
        ],
        correctness:
            "A write first invalidates all recorded sharers and any remote modified owner, so afterward only the writer holds a valid copy and the directory marks it modified. A read of a modified line forces a write-back and downgrades the owner, which makes memory current again; the reading cache then takes a shared copy equal to memory. These two cases cover every transition, so the invariant is preserved inductively.",
        complexityRationale:
            "A read or write touches only the recorded sharers of a line, at most the number of processors, giving O(sharers) work. Memory, the directory, and all caches occupy O(processes * addresses) space.",
        uses: [
            "Cache coherence in directory-based shared-memory multiprocessors",
            "Distributed shared memory systems and NUMA architectures",
            "Teaching the difference between snooping and directory protocols",
        ],
        references: [
            "Culler, Singh, and Gupta, Parallel Computer Architecture, chapter 5",
            "Sorin, Hill, and Wood, A Primer on Memory Consistency and Cache Coherence",
        ],
        workedExample:
            "With three processors, P0 and P1 read line A and both become sharers. When P0 writes A=7, the directory invalidates P1, clears the sharer set, and marks P0 the modified owner. A later read by P1 writes back 7 to memory, downgrades P0 to shared, and gives P1 a shared copy of 7.",
    },
};

export default module;
