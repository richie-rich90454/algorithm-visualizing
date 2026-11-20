/**
 * timing-attack.ts - Timing Side-Channel Attack (Toy Model)
 *
 * A naive byte comparison can run longer when more leading bits match, because
 * it returns at the first differing bit. An attacker who can time many guesses
 * therefore learns the secret one bit at a time. This teaching model simulates
 * such a comparison with a small deterministic noise term and recovers the key
 * by ranking measured times. Not a real attack on any deployed primitive.
 *
 * Time: O(256); Space: O(256).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function leadingMatchBits(a: number, b: number): number {
    let count = 0;
    for (let bit = 7; bit >= 0; bit -= 1) {
        if (((a >> bit) & 1) === ((b >> bit) & 1)) {
            count += 1;
        } else {
            break;
        }
    }
    return count;
}

function noiseFor(candidate: number, seed: number): number {
    let value = (candidate * 2654435761 + seed * 97) >>> 0;
    value ^= value >>> 13;
    value = Math.imul(value, 1274126177) >>> 0;
    return (value % 1000) / 1000 - 0.5;
}

function makeEntities(rows: Array<{ candidate: number; time: number }>): VisualEntity[] {
    return rows.map((row, index) => ({
        id: `rank-${index}`,
        type: "bar" as const,
        label: `0x${row.candidate.toString(16).padStart(2, "0")}`,
        value: row.time,
        state: index === 0 ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { candidate: row.candidate },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { key?: number; noise?: number; seed?: number } | null) ?? {};
    const key = (task.key ?? 173) & 0xff;
    const noiseLevel = task.noise ?? 0.05;
    const seed = task.seed ?? 7;

    const measurements: number[] = [];
    for (let candidate = 0; candidate < 256; candidate += 1) {
        const time = 1 + leadingMatchBits(candidate, key) + noiseFor(candidate, seed) * noiseLevel;
        measurements.push(time);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(Array.from({ length: 8 }, (_, i) => ({ candidate: i, time: 0 }))),
        edges: [],
        description: `Timing 256 candidate bytes against a comparison that leaks leading-bit matches.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", key, recovered: null as number | null, measurements: [] as number[] },
    };
    step += 1;

    for (let candidate = 0; candidate < 256; candidate += 16) {
        const rows: Array<{ candidate: number; time: number }> = [];
        for (let i = candidate; i < candidate + 16 && i < 256; i += 1) {
            rows.push({ candidate: i, time: measurements[i] ?? 0 });
        }
        rows.sort((a, b) => b.time - a.time);
        yield {
            stepNumber: step,
            entities: makeEntities(rows.slice(0, 8)),
            edges: [],
            description: `Measured candidates ${candidate} to ${Math.min(candidate + 15, 255)}; slower guesses share more prefix bits.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "measure", key, recovered: null, measurements: [...measurements] },
        };
        step += 1;
    }

    let recovered = 0;
    for (let candidate = 1; candidate < 256; candidate += 1) {
        if ((measurements[candidate] ?? 0) > (measurements[recovered] ?? 0)) {
            recovered = candidate;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities([{ candidate: recovered, time: measurements[recovered] ?? 0 }]),
        edges: [],
        description: `Slowest candidate ${recovered} reveals secret byte ${key}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", key, recovered, measurements: [...measurements] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a comparison stops at the first differing bit, guesses that match a longer prefix of the secret take measurably longer. Repeating the measurement across all byte values makes the correct byte the slowest one, so the secret leaks through time rather than through any returned value.",
        invariants: [
            "Each candidate's simulated time grows with the number of matching leading bits.",
            "The noise term is small compared with the timing gap of one bit.",
            "The candidate with the largest measured time is the recovered secret byte.",
        ],
        correctness:
            "Only the true key matches all eight bits, giving a base time of nine, while any other byte leaks at most seven. As long as the noise stays below one timing unit, the true byte is strictly the slowest, so ranking measurements recovers it exactly for the tested keys.",
        complexityRationale:
            "The attacker times all 256 possible bytes once, so recovery is O(256) time, which is constant in the byte size, and stores the same number of measurements.",
        uses: [
            "Understanding why constant-time comparisons matter in cryptography",
            "Demonstrating side-channel leakage in security training",
            "Motivating blinding and constant-time libraries",
        ],
        references: [
            "Kocher, Timing Attacks on Implementations of Diffie-Hellman, RSA, DSS, and Other Systems, 1996",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, chapter 9",
        ],
        workedExample:
            "With secret byte 173 and a small noise term, measuring every candidate byte finds 173 has the longest comparison time because it is the only guess matching all eight leading bits, so the attack recovers 173.",
    },
    id: "timing-attack",
    name: "Timing Side-Channel Attack (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(256)", space: "O(256)" },
    defaultInput: { key: 173, noise: 0.05, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "read the secret byte, noise level, and noise seed",
        "for each candidate byte from zero to 255",
        "count matching leading bits with the secret",
        "record the comparison time plus a small deterministic noise term",
        "select the candidate with the largest recorded time",
        "report the recovered secret byte and all measurements",
    ],
};

export default module;
