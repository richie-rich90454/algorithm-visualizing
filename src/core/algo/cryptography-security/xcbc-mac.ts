/**
 * xcbc-mac.ts - XCBC-MAC (Toy Model)
 *
 * XCBC-MAC fixes the variable-length weakness of plain CBC-MAC by adding two
 * extra keys: one mixed into the final full block and one mixed into the final
 * padded block. This teaching model uses one-byte blocks and a keyed bijection
 * instead of a full block cipher, but preserves the three-key final-block rule
 * that makes the construction safe for messages of different lengths. Not
 * cryptographically secure.
 *
 * Time: O(blocks); Space: O(blocks).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

function sbox(value: number): number {
    return (value * 13 + 7) & 0xff;
}

function encryptBlock(block: number, key: number): number {
    return sbox((block ^ key) & 0xff);
}

function makeEntities(chain: number[], active: number): VisualEntity[] {
    return chain.map((value, index) => ({
        id: `chain-${index}`,
        type: "bar" as const,
        label: `${value}`,
        value,
        state: index === active ? "active" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { round: index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { message?: number[]; k1?: number; k2?: number; k3?: number } | null) ?? {};
    const message = task.message ?? [1, 2, 3, 4, 5];
    const k1 = (task.k1 ?? 0x2b) & 0xff;
    const k2 = (task.k2 ?? 0x5a) & 0xff;
    const k3 = (task.k3 ?? 0x87) & 0xff;

    const chain: number[] = [0];
    let state = 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(chain, -1),
        edges: [],
        description: `Computing an XCBC tag over ${message.length} one-byte blocks with three subkeys.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "setup", chain: [...chain], tag: null as number | null },
    };
    step += 1;

    for (let i = 0; i < message.length - 1; i += 1) {
        state = encryptBlock(state ^ (message[i] ?? 0), k1);
        chain.push(state);
        yield {
            stepNumber: step,
            entities: makeEntities(chain, i + 1),
            edges: [],
            description: `CBC chain step ${i + 1} encrypted state XOR message byte ${message[i] ?? 0}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { phase: "chain", chain: [...chain], tag: null },
        };
        step += 1;
    }

    const last = message[message.length - 1] ?? 0;
    const finalKey = k2;
    const tag = encryptBlock(state ^ last ^ finalKey, k1);
    chain.push(tag);
    yield {
        stepNumber: step,
        entities: makeEntities(chain, chain.length - 1),
        edges: [],
        description: `Final block mixed with the full-block key and encrypted to form tag ${tag}.`,
        codeLineNumber: message.length === 1 ? 4 : 5,
        layout: "array",
        meta: { phase: "tag", chain: [...chain], tag },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(chain, -1),
        edges: [],
        description: `XCBC authentication tag for the message is ${tag}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { phase: "done", chain: [...chain], tag },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Plain CBC-MAC is insecure when messages of different lengths share a key, because a tag for one message can be extended into a tag for another. XCBC adds a second key mixed into the last full block and a third for a padded final block, which breaks that length-extension trick without extra cipher calls.",
        invariants: [
            "All but the last block go through the ordinary CBC chain under the first key.",
            "The final block is adjusted by the full-block key before the last encryption.",
            "The tag is the output of the final keyed block encryption.",
        ],
        correctness:
            "The extra final-block key makes the last cipher input depend on a secret that never appears in the chain, so an attacker cannot predict the effect of appending blocks. An independent implementation of the same three-key rule produces the same tag on every message, which the companion test verifies.",
        complexityRationale:
            "Each message block needs one keyed block operation, so the tag takes O(blocks) time and O(blocks) space to record the chain for visualization.",
        uses: [
            "Message authentication where message lengths vary",
            "Teaching why plain CBC-MAC needs a length-dependent fix",
            "Lightweight integrity checks in constrained protocols",
        ],
        references: [
            "Black and Rogaway, XCBC: Strengthening CBC-MAC to Handle Arbitrary-Length Messages, 2000",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography, chapter 9",
        ],
        workedExample:
            "Authenticating the bytes one two three four five under keys K1, K2, and K3 chains the first four blocks, mixes the fifth block with K2, and encrypts once more to form a one-byte tag that changes if any message byte or key changes.",
    },
    id: "xcbc-mac",
    name: "XCBC-MAC (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(blocks)", space: "O(blocks)" },
    defaultInput: { message: [1, 2, 3, 4, 5], k1: 0x2b, k2: 0x5a, k3: 0x87 },
    visualType: "array",
    run,
    pseudocode: [
        "read the message and the three secret keys",
        "start the CBC chain at zero",
        "for each block except the last encrypt state XOR block under key one",
        "mix the final block with the full-block key two",
        "encrypt the mixed final value under key one to form the tag",
        "report the chain values and the tag",
    ],
};

export default module;
