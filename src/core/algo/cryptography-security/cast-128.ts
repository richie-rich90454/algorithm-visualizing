/**
 * cast-128.ts - CAST-128 (Toy Feistel Core)
 *
 * A teaching-scale Feistel block cipher inspired by CAST-128. The published
 * cipher works on 64-bit blocks with 12 or 16 rounds and large S-boxes; this
 * model uses 16-bit blocks and a single arithmetic S-box so the full round
 * schedule is visible. It preserves the Feistel structure, so encryption and
 * decryption share the same round logic and are exact inverses. Not secure.
 *
 * Time: O(rounds); Space: O(rounds).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function sbox(value: number): number {
    return (value * 13 + 7) & 0xff;
}

function roundKey(key: number, round: number): number {
    return (key + round * 37 + ((key << 3) & 0xff)) & 0xff;
}

function roundFunction(half: number, key: number): number {
    return sbox((half ^ key) & 0xff);
}

function forwardRound(block: [number, number], key: number, round: number): [number, number] {
    const left = block[0] & 0xff;
    const right = block[1] & 0xff;
    return [right, left ^ roundFunction(right, roundKey(key, round))];
}

function crypt(block: [number, number], key: number, rounds: number, decrypt: boolean): [number, number] {
    let left = block[0] & 0xff;
    let right = block[1] & 0xff;
    for (let i = 0; i < rounds; i += 1) {
        const round = decrypt ? rounds - 1 - i : i;
        if (decrypt) {
            const previousRight = left;
            const previousLeft = right ^ roundFunction(left, roundKey(key, round));
            left = previousLeft;
            right = previousRight;
        } else {
            [left, right] = forwardRound([left, right], key, round);
        }
    }
    return [left, right];
}

function makeEntities(block: [number, number], active: number): VisualEntity[] {
    return block.map((value, index) => ({
        id: `half-${index}`,
        type: "bar" as const,
        label: `0x${value.toString(16).padStart(2, "0")}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { half: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { block?: [number, number]; key?: number; rounds?: number } | null) ?? {};
    const block: [number, number] = task.block ?? [0x12, 0x34];
    const key = (task.key ?? 0x2b) & 0xff;
    const rounds = Math.max(1, Math.min(24, Math.floor(task.rounds ?? 12)));

    let state: [number, number] = [block[0] & 0xff, block[1] & 0xff];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(state, -1),
        edges: [],
        description: `Encrypting block 0x${state[0].toString(16)}${state[1].toString(16)} with a toy ${rounds}-round Feistel core.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { round: 0, block: [...state], rounds, mode: "encrypt" },
    };
    step += 1;

    for (let round = 0; round < rounds; round += 1) {
        state = forwardRound(state, key, round);
        yield {
            stepNumber: step,
            entities: makeEntities(state, round % 2),
            edges: [],
            description: `Feistel round ${round + 1}: half-swap and XOR with the keyed round function.`,
            codeLineNumber: round === rounds - 1 ? 4 : 3,
            layout: "array",
            meta: { round: round + 1, block: [...state], rounds, mode: "encrypt" },
        };
        step += 1;
    }

    const ciphertext: [number, number] = state;
    const recovered = crypt(ciphertext, key, rounds, true);
    yield {
        stepNumber: step,
        entities: makeEntities(ciphertext, -1),
        edges: [],
        description: `Ciphertext 0x${ciphertext[0].toString(16)}${ciphertext[1].toString(16)}; decryption recovers the original block.`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            round: rounds,
            block: [...state],
            rounds,
            mode: "encrypt",
            ciphertext: [...ciphertext],
            recovered: [...recovered],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Feistel cipher splits a block in half, replaces one half with the other XORed against a keyed function, and swaps. Because the round function never has to be invertible, the same structure runs backward to decrypt. This toy core keeps the round bookkeeping visible on a tiny block.",
        invariants: [
            "Each round moves the right half into the left position unchanged.",
            "The new right half is the old left half XORed with a keyed function of the old right half.",
            "Running the rounds in reverse order with the same keys recovers the input exactly.",
        ],
        correctness:
            "Feistel networks are invertible for any round function. The reverse round computes the previous right half from the current left half and the previous left half from the current right half XORed with the same keyed value, so composing encryption with decryption is the identity for every key and block.",
        complexityRationale:
            "Each of the rounds applies one S-box lookup and a few byte operations, giving O(rounds) time and O(rounds) space for the stored round keys in this teaching version.",
        uses: [
            "Understanding the structure behind real Feistel ciphers such as CAST and DES",
            "Teaching reversible round design in cryptography courses",
            "Prototyping key schedules before committing to a full block cipher",
        ],
        references: [
            "Adams and Tavares, Designing S-boxes for Ciphers Reversible by Means of the Feistel Structure, 1990",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, chapter 7",
        ],
        workedExample:
            "Encrypting the block 0x1234 with key 0x2B over twelve rounds produces a two-byte ciphertext; feeding that ciphertext through the reverse rounds returns 0x1234 exactly, confirming the Feistel inverse property.",
    },
    id: "cast-128",
    name: "CAST-128 (Toy Feistel Core)",
    category: "cryptography-security",
    complexity: { time: "O(rounds)", space: "O(rounds)" },
    defaultInput: { block: [0x12, 0x34], key: 0x2b, rounds: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read the block, key, and number of Feistel rounds",
        "split the block into a left and a right half",
        "for each round compute a keyed function of the right half",
        "set the new left half to the old right half",
        "set the new right half to old left XOR the round function",
        "after all rounds join the halves into the ciphertext",
        "run the rounds in reverse to confirm recovery",
        "report the ciphertext and recovered block",
    ],
};

export default module;
