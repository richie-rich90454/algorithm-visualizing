/**
 * ot-extension.ts - Oblivious Transfer Extension (Toy PRG Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Oblivious transfer extension turns a small number of expensive base transfers
 * into many cheap ones. From one short base seed, a pseudorandom generator
 * expands correlated pads for every transfer index. The sender masks each of
 * its two messages with the corresponding pad; the receiver, who holds only
 * the pad for its chosen branch, unmasks exactly that message and cannot read
 * the other one. This teaching model uses a toy generator, not a secure PRG.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n extended transfers after the base seed is fixed
 *   Space: O(n) for the visualized pads and ciphertexts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows the sender's two messages per transfer.
 *   - Row one shows the receiver's chosen pad and recovered message.
 *   - meta carries the full transcript and whether every transfer succeeded.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface OtExtensionInput {
    messages?: Array<{ m0: number; m1: number }>;
    choices?: number[];
    seed?: number;
}

interface Pair {
    m0: number;
    m1: number;
}

const DEFAULT_MESSAGES: Pair[] = [
    { m0: 42, m1: 99 },
    { m0: 17, m1: 83 },
    { m0: 61, m1: 25 },
    { m0: 8, m1: 74 },
];
const DEFAULT_CHOICES = [0, 1, 1, 0];

/** A tiny deterministic generator standing in for a cryptographic PRG. */
function pad(seed: number, index: number, branch: number): number {
    const mixed = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b9) ^ Math.imul(branch + 1, 0x85ebca6b), 0x27d4eb2f) >>> 0;
    return (mixed ^ (mixed >>> 13)) & 0xff;
}

function cell(id: string, row: number, col: number, label: string, value: string | number, state: EntityState): VisualEntity {
    return { id, type: "cell", label, value, state, x: 0, y: 0, width: 0, height: 0, metadata: { row, col } };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as OtExtensionInput | null) ?? {};
    const messages: Pair[] = Array.isArray(task.messages) && task.messages.length > 0 ? task.messages : DEFAULT_MESSAGES;
    const choices = Array.isArray(task.choices) && task.choices.length > 0 ? task.choices.map((c) => (c === 1 ? 1 : 0)) : DEFAULT_CHOICES;
    const seed = Math.floor(task.seed ?? 12345) >>> 0;
    const count = messages.length;
    let step = 0;
    const emit = (entities: VisualEntity[], description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step++,
        entities,
        edges: [],
        description,
        codeLineNumber: line,
        layout: "grid",
        meta: { rows: 2, cols: Math.max(1, count), count, seed, ...meta },
    });

    yield emit([cell("seed", 0, 0, `seed=${seed}`, seed, "active")], `Starting ${count} extended transfer(s) from one base seed ${seed}.`, 0, {
        stage: "setup",
        transcript: [],
    });

    const transcript: string[] = [];
    let correct = 0;
    let hidden = 0;
    for (let i = 0; i < count; i += 1) {
        const pair = messages[i] as Pair;
        const choice = choices[i] ?? 0;
        const p0 = pad(seed, i, 0);
        const p1 = pad(seed, i, 1);
        const e0 = ((pair.m0 ^ p0) & 0xff);
        const e1 = ((pair.m1 ^ p1) & 0xff);
        const chosenPad = choice === 0 ? p0 : p1;
        const received = ((choice === 0 ? e0 : e1) ^ chosenPad) & 0xff;
        const wanted = choice === 0 ? pair.m0 : pair.m1;
        const ok = received === wanted;
        if (ok) correct += 1;
        const wrongPeek = (((choice === 0 ? e1 : e0) ^ chosenPad) & 0xff);
        if (wrongPeek !== (choice === 0 ? pair.m1 : pair.m0)) hidden += 1;
        transcript.push(`${pair.m0},${pair.m1},${choice},${p0},${p1},${e0},${e1},${received}`);

        yield emit(
            [cell(`msg0-${i}`, 0, i, String(pair.m0), pair.m0, "idle"), cell(`msg1-${i}`, 0, i, `m1:${pair.m1}`, pair.m1, "idle")],
            `Transfer ${i + 1}: the sender holds ${pair.m0} and ${pair.m1}.`,
            1,
            { stage: "messages", index: i, m0: pair.m0, m1: pair.m1 },
        );
        yield emit(
            [cell(`pad0-${i}`, 0, i, `p0:${p0}`, p0, choice === 0 ? "active" : "idle"), cell(`pad1-${i}`, 0, i, `p1:${p1}`, p1, choice === 1 ? "active" : "idle")],
            `Expanded pads ${p0} and ${p1} from the base seed; the receiver holds only pad ${chosenPad}.`,
            2,
            { stage: "pads", index: i, p0, p1, chosenPad },
        );
        yield emit(
            [cell(`c0-${i}`, 0, i, `e0:${e0}`, e0, "visited"), cell(`c1-${i}`, 0, i, `e1:${e1}`, e1, "visited")],
            `Sender publishes masked values ${e0} and ${e1}; the receiver unmask branch ${choice}.`,
            3,
            { stage: "mask", index: i, e0, e1 },
        );
        yield emit(
            [cell(`got-${i}`, 1, i, String(received), received, ok ? "sorted" : "error"), cell(`want-${i}`, 1, i, `want:${wanted}`, wanted, "visited")],
            `Receiver recovered ${received}; ${ok ? "it matches the chosen message" : "the transfer failed"}.`,
            4,
            { stage: "recover", index: i, received, wanted, ok },
        );
    }

    const allCorrect = correct === count;
    const allHidden = hidden === count;
    yield emit(
        transcript.map((entry, i) => cell(`t-${i}`, 0, i, `ot-${i}`, entry, allCorrect && allHidden ? "sorted" : "error")),
        `Done: ${correct}/${count} transfers recovered the chosen message and ${hidden}/${count} hid the other one.`,
        5,
        { stage: "done", transcript, correct, hidden, allCorrect, allHidden },
    );
}

/** The oblivious transfer extension module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Public-key operations are expensive, but symmetric pseudorandom functions are cheap. OT extension uses a few base transfers to agree on a short seed, then stretches that seed into many independent one-time pads. For each transfer the sender masks both messages and the receiver can open only the branch whose pad it holds, so one small secret buys many private selections.",
        invariants: [
            "The two pads of a transfer are derived deterministically from the seed and index.",
            "A ciphertext is the message xor its pad.",
            "The receiver holds exactly one pad per transfer, the one for its choice.",
        ],
        correctness:
            "Xor is its own inverse, so unmasking with the pad of the chosen branch returns the chosen message exactly. Unmasking the unchosen ciphertext with the chosen pad returns the unchosen message xor the xor of the two pads, which differs from the message except when those pads happen to be equal. Because the pads expand from a short seed, the receiver learns nothing about the sender's other input and the sender learns nothing about the choices. This toy generator is predictable and is not cryptographically secure.",
        complexityRationale:
            "After the base seed is fixed, each extended transfer needs two generator evaluations and a constant number of xors, so n transfers take O(n) time and O(n) transcript space.",
        uses: [
            "Secure multiparty computation as a cheap subroutine",
            "Private set intersection and contact discovery",
            "Oblivious selection in privacy-preserving machine learning",
        ],
        references: [
            "Ishai, Kilian, Nissim, and Petrank, Extending Oblivious Transfers Efficiently, 2003",
            "Asharov, Lindell, Schneider, and Zohner, More Efficient Oblivious Transfer Extensions, 2017",
        ],
        workedExample:
            "With seed 12345 and one transfer of messages 42 and 99, the generator expands pads 213 and 77. If the receiver chooses branch zero it holds 213, so the sender's masked values 243 and 38 reveal 243 xor 213 = 42 but 38 xor 213 is unrelated to 99.",
    },
    id: "ot-extension",
    name: "Oblivious Transfer Extension (Toy PRG Model)",
    category: "cryptography-security",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { messages: DEFAULT_MESSAGES, choices: DEFAULT_CHOICES, seed: 12345 },
    visualType: "grid",
    run,
    pseudocode: [
        "agree on one short base seed with a base transfer",
        "for each transfer index expand two pads from the seed",
        "give the receiver only the pad for its chosen branch",
        "mask each sender message with its branch pad",
        "receiver unmasks the chosen ciphertext with its pad",
        "check that the unchosen message stays hidden",
        "done: report the recovered messages",
    ],
};

export default module;
