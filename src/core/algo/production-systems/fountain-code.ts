/**
 * fountain-code.ts - LT Fountain Code with Peeling Decoder
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fountain code turns a block of source symbols into a stream of droplets,
 * each an exclusive-or of a small subset of those symbols. A receiver needs
 * only slightly more droplets than there were source symbols. The peeling
 * decoder repeatedly finds a droplet holding a single unknown symbol, solves
 * it by xoring out the known symbols, and then removes that symbol from every
 * remaining droplet.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * d + k^2) for m droplets, degree d, and k source symbols
 *   Space: O(m * d + k) for the droplet subsets and recovered symbols
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per droplet with its degree, xor value, and solve state.
 *   - Droplets consumed during peeling are highlighted.
 *   - The final frame reports whether every source symbol was recovered.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    symbols?: number[];
    extraDroplets?: number;
    seed?: number;
}

type Droplet = { indices: number[]; value: number };

/** Deterministic linear congruential generator for droplet selection. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
    };
}

/** Build a decodable droplet stream: one degree-one droplet per symbol, then random ones. */
function buildDroplets(symbols: number[], extra: number, seed: number): Droplet[] {
    const k = symbols.length;
    const next = makeRandom(seed);
    const sets: number[][] = [];
    for (let i = 0; i < k; i += 1) sets.push([i]);
    for (let j = 0; j < extra; j += 1) {
        const degree = 2 + (next() % Math.min(3, Math.max(1, k - 1)));
        const chosen = new Set<number>();
        let guard = 0;
        while (chosen.size < degree && guard < 100) {
            chosen.add(next() % k);
            guard += 1;
        }
        sets.push([...chosen].sort((a, b) => a - b));
    }
    return sets.map((indices) => ({
        indices,
        value: indices.reduce((acc, i) => acc ^ (symbols[i] ?? 0), 0),
    }));
}

function makeCells(
    droplets: Droplet[],
    remainingSizes: number[],
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < droplets.length; row += 1) {
        const droplet = droplets[row];
        const columns = [droplet?.indices.length ?? 0, droplet?.value ?? 0, remainingSizes[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done) state = "sorted";
            else if (row === current) state = "comparing";
            else if ((remainingSizes[row] ?? 0) === 0) state = "visited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: String(columns[col] ?? 0),
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const source = Array.isArray(task.symbols) && task.symbols.length > 0
        ? task.symbols.map((v) => Math.floor(Number(v)) >>> 0)
        : [10, 20, 30, 40, 50];
    const extra = typeof task.extraDroplets === "number" ? Math.max(0, Math.floor(task.extraDroplets)) : 4;
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 12345;
    const k = source.length;
    const droplets = buildDroplets(source, extra, seed);
    const degrees = droplets.map((d) => d.indices.length);
    const values = droplets.map((d) => d.value);

    const metaBase = {
        family: "fountain-code",
        rows: droplets.length,
        cols: 3,
        sourceCount: k,
        dropletCount: droplets.length,
        degrees,
        values,
    };

    yield {
        stepNumber: 0,
        entities: makeCells(droplets, degrees.slice(), -1, false),
        edges: [],
        description: `Fountain code with ${k} source symbols and ${droplets.length} xor droplets.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: metaBase,
    };

    let step = 1;
    for (let j = 0; j < droplets.length; j += 1) {
        const droplet = droplets[j];
        yield {
            stepNumber: step,
            entities: makeCells(droplets, degrees.slice(), j, false),
            edges: [],
            description: `Droplet ${j} xors symbols [${(droplet?.indices ?? []).join(", ")}] to value ${droplet?.value ?? 0}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...metaBase, current: j, currentDegree: droplet?.indices.length ?? 0 },
        };
        step += 1;
    }

    const known = new Array<number | null>(k).fill(null);
    const remaining = droplets.map((d) => new Set(d.indices));
    let progress = true;
    while (progress) {
        progress = false;
        for (let j = 0; j < droplets.length; j += 1) {
            const unresolved = remaining[j];
            const droplet = droplets[j];
            if (!unresolved || !droplet || unresolved.size !== 1) continue;
            const target = [...unresolved][0] as number;
            let value = droplet.value;
            for (const index of droplet.indices) {
                if (index !== target && known[index] !== null) value ^= known[index] as number;
            }
            known[target] = value;
            for (const other of remaining) other.delete(target);
            progress = true;
            yield {
                stepNumber: step,
                entities: makeCells(droplets, remaining.map((s) => s.size), j, false),
                edges: [],
                description: `Peeling solved symbol ${target} = ${value} from droplet ${j}.`,
                codeLineNumber: 4,
                layout: "grid",
                meta: {
                    ...metaBase,
                    current: j,
                    remaining: remaining.map((s) => s.size),
                    decoded: known.map((v) => (v === null ? -1 : v)),
                },
            };
            step += 1;
        }
    }

    const success = known.every((v) => v !== null);
    yield {
        stepNumber: step,
        entities: makeCells(droplets, remaining.map((s) => s.size), -1, true),
        edges: [],
        description: success
            ? `All ${k} source symbols recovered from ${droplets.length} droplets.`
            : `Decoding stalled with ${known.filter((v) => v === null).length} symbol(s) still unknown.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...metaBase,
            decoded: known.map((v) => (v === null ? -1 : v)),
            recovered: known.filter((v) => v !== null).length,
            success,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A fountain code does not fix the number of pieces in advance. It keeps producing droplets, each a small xor of source symbols, until the receiver has enough. Decoding is like solving a system of equations by repeatedly finding one with a single unknown; once that symbol is known, it can be subtracted from every other equation that contains it.",
        invariants: [
            "Every droplet value is the bitwise xor of the symbols in its subset.",
            "A recovered symbol is used only to simplify droplets that contain it.",
            "Each symbol is recovered at most once because it is removed from all subsets.",
        ],
        correctness:
            "Xor is associative and self-inverse, so a droplet with one unknown symbol equals that symbol xored with the already-known ones; xoring those known values back recovers it exactly. Because the generator always emits one degree-one droplet for each source symbol, every symbol is initially solvable. Removing a recovered symbol from all subsets preserves the invariant that each remaining droplet equals the xor of its still-unknown symbols, so the peeling process recovers every source symbol and the reported success flag confirms it.",
        complexityRationale:
            "Generating m droplets of average degree d costs O(m*d). Each peeling step scans m droplets and removes a symbol from their subsets, so worst-case decoding is O(k*m*d). Storing m subsets plus k recovered symbols uses O(m*d + k) space.",
        uses: [
            "Reliable multicast over lossy network links",
            "Distributed storage repair with rateless redundant fragments",
            "Streaming downloads where the receiver stops after enough pieces arrive",
        ],
        references: [
            "Michael Luby, LT Codes, 2002",
            "Shokrollahi, Raptor Codes, 2006",
        ],
        workedExample:
            "With source symbols 10, 20, and 30, the droplet for symbol 1 has value 20 and degree one, so it is solved immediately. Another droplet combining symbols 0 and 2 has value 10 xor 30; once those two are solved from their own degree-one droplets, the combined droplet checks out and all three symbols are recovered.",
    },
    id: "fountain-code",
    name: "Fountain Code",
    category: "production-systems",
    complexity: { time: "O(k * m * d)", space: "O(m * d + k)" },
    defaultInput: { symbols: [10, 20, 30, 40, 50], extraDroplets: 4, seed: 12345 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the source symbols and the number of extra droplets",
        "emit one degree-one droplet for each source symbol",
        "emit random xor droplets of small degree with a fixed seed",
        "for each droplet build the set of its unknown symbols",
        "while a droplet has exactly one unknown symbol solve it",
        "xor out the known symbols and remove the solved one everywhere",
        "stop when no droplet can be reduced further",
        "done: report whether every source symbol was recovered",
    ],
};

export default module;
