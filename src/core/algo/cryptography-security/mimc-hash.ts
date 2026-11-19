/**
 * mimc-hash.ts - MiMC Hash (Toy Prime-Field Model)
 *
 * MiMC is a deliberately simple cryptographic hash built from a cube map over
 * a prime field. Each round adds the message word, the key, and the round
 * index, then cubes the result modulo the prime. Cubing is cheap to describe
 * but, over a large field, requires many rounds before algebraic attacks stop
 * applying. This module implements the exact round arithmetic with BigInt so
 * it is verifiable by hand; it is a teaching model and makes no production
 * security claim.
 *
 * Time:  O(rounds * message length) big-integer cubings
 * Space: O(1) field elements
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface MimcResult {
    hash: number;
    states: number[];
}

/** Toy MiMC: fold message bytes through cube rounds in a prime field. */
export function mimcHash(message: string, key: number, rounds: number, prime: number): MimcResult {
    const p = BigInt(Math.max(3, Math.trunc(prime)));
    const r = Math.max(1, Math.trunc(rounds));
    const k = BigInt(Math.trunc(key));
    let state = 0n;
    const states: number[] = [0];
    for (let i = 0; i < message.length; i += 1) {
        const word = BigInt(message.charCodeAt(i));
        for (let round = 0; round < r; round += 1) {
            const value = (state + word + k + BigInt(round)) % p;
            const cubed = (value * value) % p;
            state = (cubed * value) % p;
            states.push(Number(state));
        }
    }
    return { hash: Number(state), states };
}

function makeBars(
    message: string,
    states: number[],
    current: number,
    phase: number,
): VisualEntity[] {
    const words = [...message].map((char) => char.charCodeAt(0));
    const values = [...words, ...states.slice(1)];
    return values.map((value, index) => {
        const state: EntityState =
            phase >= 2
                ? index === values.length - 1
                    ? "sorted"
                    : "visited"
                : phase === 1 && index === current
                  ? "active"
                  : index < words.length
                    ? "idle"
                    : "unvisited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: index < words.length ? `m${index}` : `r${index - words.length + 1}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, value, role: index < words.length ? "message" : "round" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { message?: string; key?: number; rounds?: number; prime?: number } | null
    ) ?? {};
    const message = typeof task.message === "string" ? task.message : "abc";
    const key = typeof task.key === "number" ? Math.trunc(task.key) : 11;
    const rounds = typeof task.rounds === "number" ? Math.max(1, Math.trunc(task.rounds)) : 6;
    const prime = typeof task.prime === "number" ? Math.max(3, Math.trunc(task.prime)) : 1000003;
    const result = mimcHash(message, key, rounds, prime);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(message, result.states, -1, 0),
        edges: [],
        description: `MiMC over the field modulo ${prime}: ${message.length} message word(s), ${rounds} cube round(s) each.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { prime, key, rounds, hash: 0, phase: "init", words: [...message].map((c) => c.charCodeAt(0)) },
    };
    step += 1;

    const words = [...message].map((char) => char.charCodeAt(0));
    for (let i = 0; i < words.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(message, result.states, i, 1),
            edges: [],
            description: `Loaded message word ${i} with code ${words[i]}; the state starts the cube rounds.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { prime, key, rounds, hash: 0, phase: "word", word: words[i] ?? 0, index: i, words },
        };
        step += 1;
    }

    for (let i = 1; i < result.states.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(message, result.states, i - 1, 1),
            edges: [],
            description: `Round ${((i - 1) % rounds) + 1}: state becomes (state + word + key + round)^3 mod p = ${result.states[i]}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { prime, key, rounds, hash: result.states[i] ?? 0, phase: "round", round: i, words },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(message, result.states, -1, 2),
        edges: [],
        description: `Final MiMC digest is ${result.hash} after ${words.length * rounds} cube round(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { prime, key, rounds, hash: result.hash, phase: "done", words },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "MiMC turns a message into a field element and repeatedly adds the message word, a secret key, and the round number, then cubes the sum modulo a prime. Cubing is the simplest nonlinear operation that still mixes values across the whole field. Repeating it many times makes the relationship between input and output hard to express with a short algebraic formula.",
        invariants: [
            "Every state is reduced modulo the prime, so it stays in the field.",
            "A round always adds the message word, the key, and the zero-based round index before cubing.",
            "The same message, key, prime, and round count always produce the same digest.",
        ],
        correctness:
            "Each round is a deterministic function of the previous state, the current message word, the key, and the round index, so a fixed input has one output. Changing any message word changes the added value in every round for that word, and with a large prime this propagates through subsequent cubes. The reference computation uses exact big-integer arithmetic, so the displayed digest is the literal result of the stated formula.",
        complexityRationale:
            "There are rounds cubings per message word, and each cubing is a constant number of big-integer multiplications, so time is O(rounds times message length). Only the running state and the round counter are stored, giving O(1) working space beyond the output trace.",
        uses: [
            "Teaching algebraic hash functions over finite fields",
            "Understanding the design of zero-knowledge-friendly hashes",
            "Demonstrating why hash round counts matter against algebraic attacks",
        ],
        references: [
            "Albrecht et al., MiMC: Efficient Encryption and Cryptographic Hashing with Small Multiplicative Complexity, 2016",
            "Grassi et al., On a Generalization of MiMC, 2019",
        ],
        workedExample:
            "With prime one million and three, key eleven, message abc and six rounds, the first word has code ninety seven. The first state is ninety seven plus eleven modulo the prime, cubed modulo the prime. Repeating six times for each of the three words yields the final digest shown in the last frame.",
    },
    id: "mimc-hash",
    name: "MiMC Hash (Toy Field Model)",
    category: "cryptography-security",
    complexity: { time: "O(r * |m|)", space: "O(1)" },
    defaultInput: { message: "abc", key: 11, rounds: 6, prime: 1000003 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime field, a key, and a round count",
        "start the state at zero",
        "for each message word take its character code",
        "for each round add word, key, and round index to the state",
        "cube the sum and reduce modulo the prime",
        "carry the result into the next round",
        "after all words report the final state as the digest",
    ],
};

export default module;
