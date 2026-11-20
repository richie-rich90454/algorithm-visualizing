/**
 * scalable-bloom-filter.ts - Scalable Bloom Filter
 *
 * A plain Bloom filter has a fixed capacity: once its bits are saturated the
 * false positive rate explodes. A scalable filter instead keeps a sequence of
 * layers. When the current layer fills up, a new and larger layer is added
 * with a proportionally tighter target false positive rate. Lookups consult
 * every layer, so membership never produces a false negative, while the total
 * false positive rate stays below the chosen bound.
 *
 * Time:  O(k * layers) per insertion or lookup
 * Space: O(total capacity)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BloomLayer {
    bits: boolean[];
    capacity: number;
    filled: number;
    fpr: number;
    seed: number;
}

export interface ScalableBloom {
    layers: BloomLayer[];
    initialCapacity: number;
    growth: number;
    ratio: number;
    hashes: number;
    bitsPerSlot: number;
}

function hash32(key: number, seed: number): number {
    let h = (Math.imul(key ^ seed, 0x9e3779b1) ^ (seed * 2654435761)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

/** The k bit positions a key sets in one layer. */
export function layerPositions(key: number, layer: BloomLayer, hashes: number): number[] {
    const size = layer.bits.length;
    const h1 = hash32(key, layer.seed);
    const h2 = hash32(key, layer.seed + 0x9e3779b9) | 1;
    const result: number[] = [];
    for (let i = 0; i < hashes; i += 1) {
        result.push((h1 + i * h2 + i * i) % size);
    }
    return result;
}

/** Create an empty scalable Bloom filter. */
export function createScalableBloom(
    initialCapacity = 3,
    growth = 2,
    ratio = 0.5,
    hashes = 3,
    bitsPerSlot = 16,
): ScalableBloom {
    return { layers: [], initialCapacity, growth, ratio, hashes, bitsPerSlot };
}

function addLayer(filter: ScalableBloom): BloomLayer {
    const index = filter.layers.length;
    const capacity = Math.max(1, Math.trunc(filter.initialCapacity * Math.pow(filter.growth, index)));
    const fpr = Math.min(0.5, Math.pow(ratioClamp(filter.ratio), index) * 0.01);
    const bits = Array<boolean>(Math.max(8, capacity * filter.bitsPerSlot)).fill(false);
    const layer: BloomLayer = { bits, capacity, filled: 0, fpr, seed: index * 7919 + 17 };
    filter.layers.push(layer);
    return layer;
}

function ratioClamp(value: number): number {
    return Math.max(0.1, Math.min(0.9, value));
}

/** Insert a key, growing a new layer when the current one is full. */
export function scalableInsert(filter: ScalableBloom, key: number): number {
    if (filter.layers.length === 0 || (filter.layers[filter.layers.length - 1]?.filled ?? 0) >= (filter.layers[filter.layers.length - 1]?.capacity ?? 0)) {
        addLayer(filter);
    }
    const layer = filter.layers[filter.layers.length - 1] as BloomLayer;
    for (const pos of layerPositions(key, layer, filter.hashes)) {
        layer.bits[pos] = true;
    }
    layer.filled += 1;
    return filter.layers.length - 1;
}

/** Test membership across all layers; false negatives are impossible. */
export function scalableLookup(filter: ScalableBloom, key: number): boolean {
    for (const layer of filter.layers) {
        const positions = layerPositions(key, layer, filter.hashes);
        if (positions.every((pos) => layer.bits[pos] === true)) {
            return true;
        }
    }
    return false;
}

function makeCells(
    filter: ScalableBloom,
    cols: number,
    rows: number,
    activeLayer: number,
    activePositions: number[],
    checking: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows; row += 1) {
        const layer = filter.layers[row];
        for (let col = 0; col < cols; col += 1) {
            const set = layer?.bits[col] === true;
            const active = row === activeLayer && activePositions.includes(col);
            const state: EntityState = active
                ? checking
                    ? set
                        ? "sorted"
                        : "error"
                    : "active"
                : row >= filter.layers.length
                  ? "idle"
                  : set
                    ? "visited"
                    : "unvisited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: set ? "1" : "0",
                value: set ? 1 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, layer: row, bit: set ? 1 : 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            keys?: number[];
            lookups?: number[];
            initialCapacity?: number;
            growth?: number;
            ratio?: number;
            hashes?: number;
            bitsPerSlot?: number;
        } | null
    ) ?? {};
    const keys = Array.isArray(task.keys) ? [...new Set(task.keys.map((value) => Math.trunc(value)))] : [5, 9, 13, 4, 7, 20];
    const lookups = Array.isArray(task.lookups) ? task.lookups.map((value) => Math.trunc(value)) : [9, 99];
    const filter = createScalableBloom(
        typeof task.initialCapacity === "number" ? Math.max(1, Math.trunc(task.initialCapacity)) : 3,
        typeof task.growth === "number" ? Math.max(2, Math.trunc(task.growth)) : 2,
        typeof task.ratio === "number" ? task.ratio : 0.5,
        typeof task.hashes === "number" ? Math.max(1, Math.trunc(task.hashes)) : 3,
        typeof task.bitsPerSlot === "number" ? Math.max(4, Math.trunc(task.bitsPerSlot)) : 16,
    );
    const maxLayers = Math.max(2, Math.ceil(keys.length / filter.initialCapacity) + 1);
    const cols = Math.max(8, filter.initialCapacity * Math.pow(filter.growth, maxLayers - 1) * filter.bitsPerSlot);
    const rows = maxLayers;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(filter, cols, rows, -1, [], false),
        edges: [],
        description: `Empty scalable filter: layers double in capacity and tighten their target error rate.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, phase: "init", layers: 0, inserted: 0, fpr: 0 },
    };
    step += 1;

    for (const key of keys) {
        const before = filter.layers.length;
        const layerIndex = scalableInsert(filter, key);
        const positions = layerPositions(key, filter.layers[layerIndex] as BloomLayer, filter.hashes);
        yield {
            stepNumber: step,
            entities: makeCells(filter, cols, rows, layerIndex, positions, false),
            edges: [],
            description:
                `Inserted ${key} into layer ${layerIndex}${layerIndex > before ? " (new layer)" : ""}; set bits ${positions.join(", ")}.`,
            codeLineNumber: layerIndex > before ? 2 : 3,
            layout: "grid",
            meta: {
                rows,
                cols,
                phase: "insert",
                key,
                layers: filter.layers.length,
                inserted: keys.slice(0, keys.indexOf(key) + 1).length,
                fpr: filter.layers[layerIndex]?.fpr ?? 0,
            },
        };
        step += 1;
    }

    for (const key of lookups) {
        const layerIndex = filter.layers.length > 0 ? 0 : -1;
        const layer = filter.layers[layerIndex];
        const positions = layer ? layerPositions(key, layer, filter.hashes) : [];
        const found = scalableLookup(filter, key);
        yield {
            stepNumber: step,
            entities: makeCells(filter, cols, rows, layerIndex, positions, true),
            edges: [],
            description: `Lookup ${key}: checked layer 0 bits ${positions.join(", ")} and concluded ${found ? "maybe present" : "absent"}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: {
                rows,
                cols,
                phase: "lookup",
                key,
                found,
                layers: filter.layers.length,
                inserted: keys.length,
                fpr: filter.layers[0]?.fpr ?? 0,
            },
        };
        step += 1;
    }

    let worstFpr = 0;
    for (const layer of filter.layers) {
        worstFpr = Math.max(worstFpr, layer.fpr);
    }
    yield {
        stepNumber: step,
        entities: makeCells(filter, cols, rows, -1, [], false),
        edges: [],
        description: `Filter holds ${keys.length} keys in ${filter.layers.length} layer(s); every inserted key is found.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows,
            cols,
            phase: "done",
            layers: filter.layers.length,
            inserted: keys.length,
            fpr: worstFpr,
            allPresent: keys.every((key) => scalableLookup(filter, key)),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Bloom filter says maybe or definitely not. It is fast and tiny, but once it fills up its maybe answers become unreliable. A scalable filter solves this by adding a fresh, larger layer whenever the current one is full, with a stricter error target each time. A lookup checks all layers, so a stored key can never be reported absent.",
        invariants: [
            "A key that was inserted sets all k bits of its layer, so lookups have no false negatives.",
            "A layer is sealed only after it has accepted its capacity of keys.",
            "Each new layer has double the capacity and a tighter target false positive rate than the previous one.",
        ],
        correctness:
            "Insertion sets every bit that a lookup will test in the same layer, so if a key was inserted, at least one layer passes all k bit tests; therefore no inserted key is ever reported absent. Conversely a positive can occur for a key that was never inserted when k unrelated keys happen to set the same bits, which is the controlled false positive rate.Each layer's target bounds that probability geometrically, so the union over layers stays below the chosen bound.",
        complexityRationale:
            "Each insertion sets k bits in one layer, and each lookup tests k bits in every layer, so both take O(k * layers) time. The total number of bits is proportional to the total capacity of all layers, giving O(total capacity) space.",
        uses: [
            "Caches and databases that must grow without a full rebuild",
            "Content delivery systems filtering requests for absent objects",
            "Teaching the tradeoff between false positives and filter growth",
        ],
        references: [
            "Almeida et al., Scalable Bloom Filters, Information Processing Letters, 2007",
            "Bloom, Space/Time Trade-offs in Hash Coding with Allowable Errors, 1970",
        ],
        workedExample:
            "With initial capacity three, inserting keys five, nine, thirteen fills the first layer. Key four triggers a second layer of capacity six with a tighter error target. Looking up nine checks the first layer and finds all bits set; looking up ninety nine fails at least one bit in every layer and is reported absent.",
    },
    id: "scalable-bloom-filter",
    name: "Scalable Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k * layers)", space: "O(total capacity)" },
    defaultInput: {
        keys: [5, 9, 13, 4, 7, 20],
        lookups: [9, 99],
        initialCapacity: 3,
        growth: 2,
        ratio: 0.5,
        hashes: 3,
        bitsPerSlot: 16,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with no layers and a target false positive rate",
        "when the current layer is full allocate a larger one",
        "give the new layer a tighter target false positive rate",
        "hash the key to k bit positions in the newest layer",
        "set those k bits to one",
        "for a lookup test the k bits in every layer",
        "return absent only when some tested bit is zero in all layers",
        "otherwise report that the key may be present",
    ],
};

export default module;
