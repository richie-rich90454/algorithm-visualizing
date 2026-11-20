/**
 * concatenated-code.ts - Two-Level Concatenated Repetition Code
 *
 * Concatenation builds a stronger code from a weaker one by encoding each
 * physical qubit of the first code with a fresh copy of the code. Here the
 * three-qubit bit-flip repetition code is applied twice, so one logical bit
 * becomes nine physical bits grouped into three inner blocks of three. Each
 * block votes away a single flip, and an outer vote repairs a block whose
 * majority was wrong. The combined distance four code corrects any two
 * physical flips.
 *
 * This is an exact decoding simulation on classical bit strings. It models
 * bit-flip errors only, perfect syndrome extraction, and a deterministic
 * majority decoder; it does not simulate phase errors, coherent errors, noisy
 * measurements, or the quantum circuits that would implement the encoding.
 *
 * Time:  O(1) for nine bits
 * Space: O(1) for the bit string and syndromes
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface ConcatenatedInput {
    logical?: number;
    errors?: number[];
}

function majority(bits: number[]): number {
    const ones = bits.reduce((sum, bit) => sum + (bit === 1 ? 1 : 0), 0);
    return ones >= 2 ? 1 : 0;
}

function makeEntities(bits: number[], activeBlock: number, final: boolean): VisualEntity[] {
    return bits.map((bit, index) => ({
        id: `qubit-${index}`,
        type: "bar" as const,
        label: `q${index}: ${bit}`,
        value: bit,
        state: final
            ? "sorted"
            : Math.floor(index / 3) === activeBlock
              ? "comparing"
              : bit === 1
                ? "active"
                : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, bit, block: Math.floor(index / 3) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ConcatenatedInput | null) ?? {};
    const logical: number = task.logical === 1 ? 1 : 0;
    const errors = Array.isArray(task.errors)
        ? task.errors.map((e) => Math.floor(Number(e))).filter((e) => e >= 0 && e < 9)
        : [1, 6];
    const encoded = Array.from({ length: 9 }, () => logical);
    const corrupted = [...encoded];
    for (const index of errors) {
        corrupted[index] = (corrupted[index] ?? 0) === 1 ? 0 : 1;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(encoded, -1, false),
        edges: [],
        description: `Encode logical ${logical} by repeating it across nine physical bits in three blocks of three.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { logical, errors, bits: [...encoded], blockValues: [], decoded: logical, done: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(corrupted, -1, false),
        edges: [],
        description: `Applied bit flips at positions ${errors.join(", ") || "none"}; each inner block now votes on its value.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { logical, errors, bits: [...corrupted], blockValues: [], decoded: logical, done: false },
    };
    step += 1;

    const decodedBlocks: number[] = [];
    const syndrome: number[] = [];
    const repaired = [...corrupted];
    for (let block = 0; block < 3; block += 1) {
        const start = block * 3;
        const bits = [repaired[start] ?? 0, repaired[start + 1] ?? 0, repaired[start + 2] ?? 0];
        syndrome.push((bits[0] ?? 0) ^ (bits[1] ?? 0));
        syndrome.push((bits[1] ?? 0) ^ (bits[2] ?? 0));
        const vote = majority(bits);
        decodedBlocks.push(vote);
        for (let offset = 0; offset < 3; offset += 1) {
            repaired[start + offset] = vote;
        }
        yield {
            stepNumber: step,
            entities: makeEntities(repaired, block, false),
            edges: [],
            description: `Inner block ${block}: bits ${bits.join("")} with syndrome ${syndrome.slice(-2).join("")} vote to ${vote}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                logical,
                errors,
                bits: [...repaired],
                blockValues: [...decodedBlocks],
                syndrome: [...syndrome],
                decoded: logical,
                done: false,
            },
        };
        step += 1;
    }

    const decoded = majority(decodedBlocks);
    const success = decoded === logical;
    yield {
        stepNumber: step,
        entities: makeEntities(Array.from({ length: 9 }, () => decoded), -1, true),
        edges: [],
        description: `Outer vote over block values ${decodedBlocks.join("")} gives logical ${decoded}${success ? ", matching the input" : ", failing to recover the input"}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            logical,
            errors,
            bits: Array.from({ length: 9 }, () => decoded),
            blockValues: decodedBlocks,
            syndrome,
            decoded,
            success,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single repetition bit can fix one flip but fails on two. Concatenation applies the same idea twice: first each of three logical positions is protected by a block of three bits, then the three block values are protected by an outer majority vote. A flip inside a block is fixed locally; a whole block that voted wrong is fixed by the outer vote. The two layers together handle twice as many errors as either alone.",
        invariants: [
            "Each inner block is always set to the majority of its three bits after decoding.",
            "The outer decoder sees exactly three block values, so its majority vote is unambiguous.",
            "Without errors every block and the outer vote reproduce the input logical bit.",
        ],
        correctness:
            "For a block of three, a single flip leaves two bits at the original value, so majority vote restores it exactly. If a block suffers two flips, its majority is wrong, but the outer layer treats that as one wrong block among three; as long as at most one block is wrong, the outer majority restores the logical bit. Any two physical flips either fall in separate blocks, where both inner votes fix them, or in the same block, where the single bad block is repaired by the outer vote. Hence every pattern of two or fewer flips is corrected.",
        complexityRationale:
            "The encoder writes nine bits, each inner decoder reads three bits, and the outer decoder reads three block values, so the whole decode is constant time and constant space for a fixed code size. In general a two-level code over n physical bits still decodes in linear time.",
        uses: [
            "A teaching model for concatenated error-correcting codes",
            "A baseline for comparing code distance against overhead",
            "An introduction to hierarchical fault-tolerant encoding",
        ],
        references: [
            "Shor, Scheme for Reducing Decoherence in Quantum Computer Memory, 1995",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 10",
        ],
        workedExample:
            "Encoding logical zero gives 000000000. Flipping bits one and six produces 010000100: the first block votes to zero, the middle block stays zero, and the last block votes to zero after correcting bit six. The outer vote over 000 returns zero, so both errors are repaired.",
    },
    id: "concatenated-code",
    name: "Concatenated Code",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { logical: 0, errors: [1, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "repeat the logical bit three times to form the inner code",
        "repeat each inner bit three times to form nine physical bits",
        "apply the given bit-flip errors",
        "for each inner block compute its two parity syndrome bits",
        "set the whole block to the majority of its three bits",
        "collect the three block values",
        "set the logical result to the majority of the block values",
        "done: report whether the input logical bit was recovered",
    ],
};

export default module;
