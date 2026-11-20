/**
 * broadcast-encryption.ts - Broadcast Encryption (Toy Subset-Cover Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This teaching toy models broadcast encryption: a center encrypts one session
 * key to a privileged subset of users, and only those users can recover it.
 * Each user has a deterministic key-encryption key derived from a master
 * secret. The broadcast header carries one wrapped copy of the session key per
 * privileged user. A user tries to unwrap an entry with their own key; a user
 * outside the privileged set derives a different key and fails. It illustrates
 * the subset-cover idea but is not a secure scheme.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(|S| + U) for a header of |S| entries over U users
 *   Space: O(|S| + U)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per user shows that user's derived key modulo 256.
 *   - Privileged users are highlighted while the header is built.
 *   - The final frame reports the ciphertext and the session key.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const MOD = 256;

/** Toy key derivation from a master secret and a user id. */
function deriveKey(master: number, id: number): number {
    let h = ((master + 1) * 2654435761 + (id + 1) * 40503) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    return (h ^ (h >>> 15)) % MOD;
}

/** Wrap a session key with a user key by modular addition. */
function wrap(sessionKey: number, userKey: number): number {
    return (sessionKey + userKey) % MOD;
}

/** Undo a wrap; returns the candidate session key. */
function unwrap(wrapped: number, userKey: number): number {
    return (wrapped - userKey + MOD) % MOD;
}

function buildEntities(userIds: number[], privileged: Set<number>, derived: Map<number, number>, active: number): VisualEntity[] {
    return userIds.map((id) => ({
        id: `user-${id}`,
        type: "bar" as const,
        label: `${id}:${derived.get(id) ?? 0}`,
        value: derived.get(id) ?? 0,
        state: (id === active ? "active" : privileged.has(id) ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { userId: id, privileged: privileged.has(id) },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        userCount?: number;
        privileged?: number[];
        message?: number;
        masterSecret?: number;
        sessionKey?: number;
    } | null) ?? {};
    const userCount = typeof task.userCount === "number" ? Math.max(1, task.userCount) : 6;
    const userIds = Array.from({ length: userCount }, (_, i) => i);
    const privilegedList = Array.isArray(task.privileged)
        ? task.privileged.filter((id) => id >= 0 && id < userCount)
        : [0, 2, 4];
    const privileged = new Set(privilegedList);
    const masterSecret = typeof task.masterSecret === "number" ? task.masterSecret : 1337;
    const sessionKey = typeof task.sessionKey === "number" ? task.sessionKey : 173;
    const message = typeof task.message === "number" ? task.message : 42;

    const derived = new Map<number, number>();
    for (const id of userIds) derived.set(id, deriveKey(masterSecret, id));

    let step = 0;
    yield {
        stepNumber: step++,
        entities: buildEntities(userIds, privileged, derived, -1),
        edges: [],
        description: `Preparing a broadcast to ${privileged.size} privileged of ${userCount} users.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { userCount, privileged: [...privileged], masterSecret, phase: "start" },
    };

    const header: Array<{ userId: number; wrapped: number }> = [];
    for (const id of privilegedList) {
        const wrapped = wrap(sessionKey, derived.get(id) as number);
        header.push({ userId: id, wrapped });
        yield {
            stepNumber: step++,
            entities: buildEntities(userIds, privileged, derived, id),
            edges: [],
            description: `Wrapped session key ${sessionKey} for user ${id} as header value ${wrapped}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { header: [...header], activeUser: id, phase: "header" },
        };
    }

    const cipher = (message + sessionKey) % MOD;
    const recovered: Record<string, number | boolean> = {};
    for (const id of userIds) {
        const key = derived.get(id) as number;
        let found = false;
        for (const entry of header) {
            if (unwrap(entry.wrapped as number, key) === sessionKey) {
                found = true;
                break;
            }
        }
        recovered[`user${id}`] = found ? (cipher - sessionKey + MOD) % MOD : false;
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(userIds, privileged, derived, -1),
        edges: [],
        description: `Broadcast complete: ciphertext ${cipher}; only ${privileged.size} privileged user(s) recover the message ${message}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            header,
            cipher,
            sessionKey,
            message,
            recovered,
            privileged: [...privileged],
            phase: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A broadcast center wants one transmission that only a chosen group can open. It gives every user a personal key and includes, in the header, a copy of the session key wrapped under each privileged user's key. A privileged user finds an entry they can unwrap; anyone else only sees unusable values. Real subset-cover systems compress the header using tree structure instead of listing every user.",
        invariants: [
            "Each user's derived key is deterministic from the master secret and id.",
            "Every privileged user receives exactly one wrapped copy of the session key.",
            "Unwrapping an entry succeeds only when the derived key matches the one used to wrap it.",
        ],
        correctness:
            "For a privileged user u the header contains wrap(K, key(u)), and unwrap returns (K + key(u) - key(u)) mod 256 = K, so the message is recovered. An unprivileged user derives a different key; because distinct user keys are used, no wrap equals K under that key, so recovery fails. The exhaustive user scan in the final frame checks exactly this condition for every user. This toy uses modular addition rather than a real cipher, so it teaches access control rather than providing security.",
        complexityRationale:
            "Building the header is linear in the privileged set size, and the final verification tries every header entry for every user, which is O(U * |S|), reported as O(|S| + U) for the broadcast itself with U users and |S| entries.",
        uses: [
            "Explaining pay-per-view and digital rights management key distribution",
            "Introducing subset-cover and revocation schemes",
            "Teaching the difference between encryption and access control",
        ],
        references: [
            "Naor and Naor, Small-Bias Probability Spaces with Applications to Broadcast Encryption (subset cover)",
            "Boneh, Halevi and Hamburg, Hierarchical Identity Based Encryption with applications to broadcast",
        ],
        workedExample:
            "With session key 173 and a user key of 40, the header value is (173 + 40) mod 256 = 213. That user unwraps (213 - 40) = 173 and decrypts the ciphertext; a user with key 41 unwraps to 172 and fails.",
    },
    id: "broadcast-encryption",
    name: "Broadcast Encryption (Toy Subset-Cover)",
    category: "cryptography-security",
    complexity: { time: "O(|S| + U)", space: "O(|S| + U)" },
    defaultInput: { userCount: 6, privileged: [0, 2, 4], message: 42, masterSecret: 1337, sessionKey: 173 },
    visualType: "array",
    run,
    pseudocode: [
        "derive a personal key for every user from the master secret",
        "choose a random session key and wrap it under each privileged key",
        "place every wrapped copy in the broadcast header",
        "encrypt the message by adding the session key",
        "for each user, try to unwrap each header entry with their key",
        "a successful unwrap yields the session key and the message",
        "done: report the ciphertext and who can recover it",
    ],
};

export default module;
