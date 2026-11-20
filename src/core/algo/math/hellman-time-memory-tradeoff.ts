/**
 * hellman-time-memory-tradeoff.ts - Hellman Time-Memory Tradeoff
 *
 * Hellman's method inverts a one-way function by precomputing chains of
 * iterated applications and storing only their endpoints. To invert a target,
 * the attacker walks forward from the target until an endpoint is hit, then
 * rebuilds that chain from its stored start to read off the predecessor. The
 * precomputed table trades memory for the time needed at attack time.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    let b = base % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) result = (result * b) % mod;
        b = (b * b) % mod;
        e /= 2n;
    }
    return result;
}

function makeCells(cells: Array<[string, string]>, highlight: number): VisualEntity[] {
    return cells.map(([label, value], index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: value ? `${label}: ${value}` : label,
        value,
        state: (index === highlight ? "active" : value ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.floor(index / 2), col: index % 2, index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        n?: number; a?: number; b?: number; chains?: number; chainLength?: number; target?: number; seed?: number;
    } | null) ?? {};
    const n = BigInt(Math.max(101, Math.floor(task.n ?? 10007)));
    const a = BigInt(Math.floor(task.a ?? 445));
    const b = BigInt(Math.floor(task.b ?? 3391));
    const chainCount = Math.max(1, Math.floor(task.chains ?? 48));
    const chainLength = Math.max(2, Math.floor(task.chainLength ?? 60));
    const target = BigInt(Math.max(0, Math.floor(task.target ?? 4321)));
    let seed = (Math.floor(task.seed ?? 7) >>> 0) || 7;
    const rand = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    const f = (x: bigint): bigint => (a * x + b) % n;
    const aInv = powMod(a, n - 2n, n);
    const fInv = (y: bigint): bigint => (((aInv * (((y - b) % n + n) % n)) % n) + n) % n;

    const frames: VisualFrame[] = [];
    const table = new Map<bigint, bigint>();
    const push = (cells: Array<[string, string]>, desc: string, line: number, highlight = -1, preimage = -1n, verified = false, steps = 0): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeCells(cells, highlight),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "grid",
            meta: {
                n: n.toString(),
                chains: chainCount,
                chainLength,
                target: target.toString(),
                preimage: preimage.toString(),
                verified,
                steps,
                coverage: chainCount * chainLength,
                endpoints: [...table.keys()].map((k) => k.toString()),
            },
        });
    };

    push([
        ["modulus", n.toString()],
        ["chains", String(chainCount)],
        ["length", String(chainLength)],
        ["target", target.toString()],
    ], `Building ${chainCount} chains of length ${chainLength} over ${n} values.`, 0);

    for (let c = 0; c < chainCount; c += 1) {
        let start = BigInt(1 + Math.floor(rand() * (Number(n) - 1)));
        let end = start;
        for (let k = 0; k < chainLength; k += 1) end = f(end);
        if (!table.has(end)) table.set(end, start);
    }
    push([["endpoints", String(table.size)], ["coverage", String(chainCount * chainLength)], ["target", target.toString()], ["stored", "endpoints only"]], `Stored ${table.size} distinct chain endpoints.`, 2);

    let cur = target;
    let preimage = -1n;
    let steps = 0;
    let verified = false;
    for (let t = 0; t <= chainLength; t += 1) {
        const start = table.get(cur);
        if (start !== undefined) {
            const remaining = chainLength - t - 1;
            let candidate: bigint;
            if (remaining < 0) {
                candidate = fInv(cur);
            } else {
                candidate = start;
                for (let k = 0; k < remaining; k += 1) candidate = f(candidate);
            }
            if (f(candidate) === target) {
                preimage = candidate;
                verified = true;
            }
            push(
                [["endpoint hit", "yes"], ["chain start", start.toString()], ["preimage", preimage.toString()], ["verified", verified ? "yes" : "no"]],
                `Endpoint found after ${t} step(s); candidate predecessor is ${preimage.toString()}.`,
                4,
                3,
                preimage,
                verified,
                t,
            );
            break;
        }
        steps += 1;
        if (frames.length < 26) {
            push([["search step", String(t)], ["current", cur.toString()], ["target", target.toString()], ["endpoints", String(table.size)]], `Step ${t}: current value ${cur} is not a stored endpoint.`, 3, -1, -1n, false, t);
        }
        cur = f(cur);
    }

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeCells(
            [["target", target.toString()], ["preimage", preimage.toString()], ["verified", verified ? "yes" : "no"], ["steps", String(steps)]],
            2,
        ),
        edges: [],
        description: verified
            ? `Done: inverted ${target} to a predecessor in ${steps} step(s).`
            : `Done: no stored chain led back to ${target}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            n: n.toString(),
            chains: chainCount,
            chainLength,
            target: target.toString(),
            preimage: preimage.toString(),
            verified,
            steps,
            coverage: chainCount * chainLength,
            endpoints: [...table.keys()].map((k) => k.toString()),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of storing every input and its inverse, store a few long chains of repeated hashing, keeping only each chain's start and end. To invert a value, keep hashing until you land on a stored end, then replay that chain to find the value just before your target.",
        invariants: [
            "Every chain endpoint is reachable from its stored start by exactly chainLength applications.",
            "The search walks the same function the table was built from.",
            "A reported predecessor always satisfies f(predecessor) = target.",
        ],
        correctness:
            "If the forward walk from the target reaches a stored endpoint, that endpoint lies on a known chain and the position of the target in the chain can be reconstructed by replaying from the start. The value immediately before the target is then a valid preimage, verified by one extra application of the function. The method may fail to find a preimage when no chain covers the target, but it never reports an incorrect one.",
        complexityRationale:
            "Precomputation costs chains times chainLength applications and stores one start and end per chain. Inversion needs at most chainLength forward steps plus one chain replay, illustrating the tradeoff between table size and attack time.",
        uses: [
            "Password cracking with precomputed hash chains",
            "Teaching the time-memory tradeoff in cryptanalysis",
            "Inverting small-domain one-way functions in constraint solvers",
        ],
        references: [
            "Hellman, A Cryptanalytic Time-Memory Trade-Off, IEEE Transactions on Information Theory, 1980",
            "Menezes, Oorschot and Vanstone, Handbook of Applied Cryptography, chapter on hash-function attacks",
        ],
        workedExample:
            "With a permutation f over 10007 values, build 48 chains of length 60 and store their endpoints. To invert target 4321, apply f repeatedly until an endpoint is seen, then replay that chain to the position just before 4321 and check that f of it equals 4321.",
    },
    id: "hellman-time-memory-tradeoff",
    name: "Hellman Time-Memory Tradeoff",
    category: "math",
    complexity: { time: "O(m*t) precompute, O(t) attack", space: "O(m)" },
    defaultInput: { n: 10007, a: 445, b: 3391, chains: 48, chainLength: 60, target: 4321, seed: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a one-way permutation and a chain count and length",
        "for each chain, start at a pseudorandom value and hash length times",
        "store the chain start and its endpoint in a table",
        "to invert a target, hash it repeatedly until an endpoint is found",
        "replay the matching chain from its start to the position before the target",
        "verify that one more hash gives the target",
        "done: return the predecessor or report failure",
    ],
};

export default module;
