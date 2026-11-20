/**
 * prediction-by-partial-matching.ts - Prediction by Partial Matching (PPM)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PPM predicts the next symbol from the longest suffix of past symbols that
 * has been seen before. For each position it tries contexts of decreasing
 * length; the first context with a stored statistics table supplies the
 * probability of the actual next symbol, or an escape probability when that
 * symbol has not occurred in that context. The code length contributed by a
 * symbol is minus the base-two logarithm of its probability. After coding a
 * symbol, every context that ends just before it is updated. PPM is the basis
 * of several strong lossless compressors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * order * alphabet) with map lookups treated as constant
 *   Space: O(order * distinct contexts * alphabet)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One character entity per symbol of the sequence.
 *   - The coded symbol is CYAN and already coded symbols are GREEN.
 *   - The final frame reports the total ideal code length in bits.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Count, for every context, how often each next symbol followed it. */
function buildModel(sequence: string[], order: number, upTo: number): Map<string, Map<string, number>> {
    const model = new Map<string, Map<string, number>>();
    for (let i = 0; i < upTo; i += 1) {
        const symbol = sequence[i];
        if (symbol === undefined) continue;
        for (let d = 1; d <= order; d += 1) {
            if (i < d) continue;
            const context = sequence.slice(i - d, i).join("");
            let table = model.get(context);
            if (!table) {
                table = new Map<string, number>();
                model.set(context, table);
            }
            table.set(symbol, (table.get(symbol) ?? 0) + 1);
        }
    }
    return model;
}

/** Probability assigned to a symbol at a position, using the longest context. */
function probability(
    sequence: string[],
    index: number,
    order: number,
    model: Map<string, Map<string, number>>,
    distinctSoFar: number,
): number {
    const symbol = sequence[index] ?? "";
    for (let d = order; d >= 1; d -= 1) {
        if (index < d) continue;
        const table = model.get(sequence.slice(index - d, index).join(""));
        if (!table) continue;
        const total = [...table.values()].reduce((sum, v) => sum + v, 0);
        if (total === 0) continue;
        const count = table.get(symbol) ?? 0;
        return count > 0 ? count / total : 1 / (total + 1);
    }
    return 1 / Math.max(1, distinctSoFar + 1);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sequence?: string; order?: number } | null) ?? {};
    const sequence = [...(typeof task.sequence === "string" ? task.sequence : "abacabad")];
    const order = Math.max(1, Math.min(4, Math.floor(task.order ?? 2)));

    const entities = (active: number): VisualEntity[] =>
        sequence.map((ch, index) => ({
            id: `char-${index}`,
            type: "character" as const,
            label: ch,
            value: ch,
            state: index === active ? "active" : index < active ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, symbol: ch },
        }));

    const probabilities: number[] = [];
    let totalBits = 0;
    const seen = new Set<string>();

    yield {
        stepNumber: 0,
        entities: entities(-1),
        edges: [],
        description: `Coding ${sequence.length} symbol(s) with PPM contexts up to order ${order}.`,
        codeLineNumber: 0,
        layout: "text",
        meta: { order, totalBits: 0, probabilities: [], length: sequence.length },
    };
    let step = 1;
    for (let i = 0; i < sequence.length; i += 1) {
        const model = buildModel(sequence, order, i);
        const p = probability(sequence, i, order, model, seen.size);
        const bits = -Math.log2(p);
        probabilities.push(p);
        totalBits += bits;
        yield {
            stepNumber: step,
            entities: entities(i),
            edges: [],
            description: `Symbol ${i} ("${sequence[i]}") gets probability ${p.toFixed(3)}, costing ${bits.toFixed(3)} bit(s).`,
            codeLineNumber: 2,
            layout: "text",
            meta: { order, totalBits, probabilities: [...probabilities], index: i, probability: p, bits },
        };
        step += 1;
        seen.add(sequence[i] ?? "");
    }
    yield {
        stepNumber: step,
        entities: entities(-1),
        edges: [],
        description: `Coded ${sequence.length} symbol(s); ideal total code length ${totalBits.toFixed(3)} bits.`,
        codeLineNumber: 6,
        layout: "text",
        meta: { order, totalBits, probabilities, length: sequence.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Common text repeats short patterns. PPM keeps a table of what tends to follow each recently seen suffix, then predicts the next character with the longest suffix it recognizes. If a character is new in that context the model escapes to a shorter context, paying a small penalty. Coding a character costs fewer bits when the prediction was confident, which is why PPM compresses natural text well.",
        invariants: [
            "A context table only contains symbols that actually followed that context in the past.",
            "Counts in a context sum to the number of times the context has been observed.",
            "A probability is always strictly between zero and one, so code lengths are finite.",
        ],
        correctness:
            "The model is built from all positions strictly before the coded one, so it contains no information about the current symbol. The longest recognized context gives an empirical distribution over next symbols; using the symbol's count over the context total is a consistent probability estimate, and the escape value covers unseen symbols. Summing minus log base two of each probability gives the ideal prefix code length for the sequence under that model.",
        complexityRationale:
            "Building the model from scratch scans the prefix once per position while updating at most order contexts; with constant-time map access this is O(n times order) per position and O(n squared times order) for the whole displayed run. Space is proportional to the number of distinct contexts times their symbol tables.",
        uses: [
            "Lossless text and source coding compressors",
            "Language modeling and character-level prediction",
            "Benchmarks for arithmetic and range coders",
        ],
        references: [
            "Cleary and Witten, Data Compression Using Adaptive Coding and Partial String Matching, 1984",
            "Bell, Witten and Cleary, Modeling for Text Compression, 1989",
        ],
        workedExample:
            "For the sequence abab with order one, the first b follows context a once, so after that occurrence context a predicts b with probability one and codes b in zero bits. An unseen symbol after a pays the escape probability one half, costing one bit.",
    },
    id: "prediction-by-partial-matching",
    name: "Prediction by Partial Matching (PPM)",
    category: "production-systems",
    complexity: { time: "O(n^2 * order)", space: "O(order * contexts)" },
    defaultInput: { sequence: "abacabad", order: 2 },
    visualType: "text",
    run,
    pseudocode: [
        "choose the maximum context order",
        "for each symbol position in the sequence",
        "build counts of symbols following each past context",
        "find the longest context seen before this position",
        "divide the symbol's count by that context's total",
        "if unseen use an escape probability over the total",
        "add minus log base two of the probability to the code length",
        "update every context ending just before this symbol",
        "done: report the total ideal code length in bits",
    ],
};

export default module;
