/**
 * snow-3g.ts - SNOW 3G Stream Cipher (Teaching Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SNOW 3G combines a linear-feedback shift register with a small finite-state
 * machine. Each clock steps the register, mixes one register word into the
 * machine's two memory words through an S-box, and xors the machine output with
 * a register word to produce a 16-bit keystream word. The real cipher uses
 * 32-bit words and three S-boxes; this model keeps the same register-plus-FSM
 * structure with smaller words so it can be replayed step by step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(words) for generation, with constant work per word
 *   Space: O(16) for the register and machine state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the regenerated keystream words.
 *   - The most recent word is highlighted; earlier words are idle.
 *   - meta carries the keystream, register snapshot, and machine words.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MASK = 0xffff;

function makeSbox(): number[] {
    const box = Array.from({ length: 256 }, (_, i) => i);
    let state = 987654321;
    for (let i = 255; i > 0; i -= 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const j = state % (i + 1);
        const temp = box[i]!;
        box[i] = box[j]!;
        box[j] = temp;
    }
    return box;
}

const SBOX = makeSbox();

export interface SnowState {
    lfsr: number[];
    r1: number;
    r2: number;
}

/** Initialize the sixteen-word register from four key and four IV words. */
export function snowInit(key: number[], iv: number[]): SnowState {
    const word = (value: number | undefined) => ((Math.floor(value ?? 0) & MASK) + MASK) % MASK;
    const k = [0, 1, 2, 3].map((i) => word(key[i]));
    const v = [0, 1, 2, 3].map((i) => word(iv[i]));
    const lfsr = Array.from({ length: 16 }, (_, i) => {
        if (i < 4) return k[i]!;
        if (i < 8) return v[i - 4]!;
        return (k[(i - 8) % 4]! ^ ((i * 4660 + 17) & MASK)) & MASK;
    });
    let state: SnowState = { lfsr, r1: 0, r2: 0 };
    for (let i = 0; i < 10; i += 1) state = snowClock(state).state;
    return state;
}

/** Step the register and finite-state machine once, returning one keystream word. */
export function snowClock(state: SnowState): { state: SnowState; word: number } {
    const lfsr = state.lfsr.slice();
    const rotated = ((lfsr[0]! << 1) | (lfsr[0]! >>> 15)) & MASK;
    const feedback = (rotated ^ lfsr[2]! ^ lfsr[5]! ^ lfsr[11]!) & MASK;
    const mixed = SBOX[(lfsr[15]! + state.r1) & 255]! | (SBOX[(lfsr[15]! >>> 8) & 255]! << 8);
    const fsm = ((mixed & MASK) + state.r2) & MASK;
    const output = (fsm ^ lfsr[0]!) & MASK;
    for (let i = 0; i < 15; i += 1) lfsr[i] = lfsr[i + 1]!;
    lfsr[15] = feedback;
    return { state: { lfsr, r1: fsm, r2: state.r1 }, word: output };
}

/** Generate a run of keystream words. */
export function snowKeystream(state: SnowState, count: number): { state: SnowState; words: number[] } {
    let current = state;
    const words: number[] = [];
    for (let i = 0; i < count; i += 1) {
        const stepped = snowClock(current);
        current = stepped.state;
        words.push(stepped.word);
    }
    return { state: current, words };
}

function makeBars(words: number[], active: number, state: EntityState): VisualEntity[] {
    return words.map((word, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `z${index}:${word}`,
        value: word,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, word },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { key?: number[]; iv?: number[]; words?: number } | null) ?? {};
    const key = [0, 1, 2, 3].map((i) => Math.floor(task.key?.[i] ?? i * 4096 + 17));
    const iv = [0, 1, 2, 3].map((i) => Math.floor(task.iv?.[i] ?? i * 1024 + 3));
    const count = Math.min(48, Math.max(1, Math.floor(Number(task.words ?? 12)) || 12));
    let state = snowInit(key, iv);
    const words: number[] = [];
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: [],
        edges: [],
        description: `SNOW 3G teaching core initialized with four key and four IV words.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { toy: true, words: [], r1: state.r1, r2: state.r2, register: state.lfsr.slice() },
    };
    stepNumber += 1;

    for (let i = 0; i < count; i += 1) {
        const stepped = snowClock(state);
        state = stepped.state;
        words.push(stepped.word);
        yield {
            stepNumber: stepNumber,
            entities: makeBars(words, words.length - 1, "sorted"),
            edges: [],
            description: `Clock ${i}: keystream word ${stepped.word} from the FSM output xor register word zero.`,
            codeLineNumber: 1,
            layout: "array",
            meta: {
                toy: true,
                words: [...words],
                r1: state.r1,
                r2: state.r2,
                register: state.lfsr.slice(),
            },
        };
        stepNumber += 1;
    }

    yield {
        stepNumber: stepNumber,
        entities: makeBars(words, -1, "sorted"),
        edges: [],
        description: `Generated ${count} keystream word(s); final machine state r1 ${state.r1}, r2 ${state.r2}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            toy: true,
            words: [...words],
            r1: state.r1,
            r2: state.r2,
            register: state.lfsr.slice(),
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A linear register alone would be predictable, so the cipher pushes one of its words through a nonlinear state machine before emitting output. The machine keeps two words of memory that change every clock, while the register shifts a feedback bit pattern computed from four tap positions. The emitted word is the machine output xored with the oldest register word.",
        invariants: [
            "The register always contains sixteen sixteen-bit words.",
            "The feedback word is the xor of four tapped and rotated register words.",
            "Each keystream word is the finite-state output xored with register word zero.",
        ],
        correctness:
            "Because the state transition is deterministic, the same key and initialization vector always produce the same keystream. The register shift is a bijection on its state and the machine update depends on the current register word, so the combined state evolves without collapsing to a fixed point for nondegenerate inputs. Decryption regenerates the identical keystream and xors it again to recover the plaintext.",
        complexityRationale:
            "Each clock touches a constant number of register and machine words, so generating n words takes linear time. The state is sixteen register words plus two machine words, giving constant space.",
        uses: [
            "Confidentiality in third-generation mobile networks",
            "Stream-cipher design and cryptanalysis teaching",
            "Teaching the register plus finite-state-machine construction",
        ],
        references: [
            "3GPP TS 35.215, SNOW 3G Algorithm Specification, 2006",
            "Nyberg, A New Stream Cipher: SNOW, 2000",
        ],
        workedExample:
            "Load four key words and four IV words into the first eight register slots and fill the rest from a fixed expansion. After ten warm-up clocks, one output clock rotates register word zero, xors taps two, five and eleven into new feedback, mixes register word fifteen with machine word r1 through the S-box, and xors the result with the old register word zero.",
    },
    id: "snow-3g",
    name: "SNOW 3G Stream Cipher (Teaching Core)",
    category: "cryptography-security",
    complexity: { time: "O(w)", space: "O(1)" },
    defaultInput: { key: [17, 4096, 8193, 3], iv: [3, 1027, 2051, 7], words: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "load key and IV words into the sixteen-word register",
        "initialize the two finite-state machine words to zero",
        "discard ten warm-up output words",
        "for each output word compute the rotated feedback from four taps",
        "mix the last register word with machine word one through the S-box",
        "set the output to the mixed word xor register word zero",
        "shift the register and update the machine memory",
        "done: report the generated keystream",
    ],
};

export default module;
