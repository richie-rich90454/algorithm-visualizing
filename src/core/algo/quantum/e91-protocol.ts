/**
 * e91-protocol.ts - E91 Entanglement-Based Quantum Key Distribution (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In E91 a source distributes entangled Bell pairs to Alice and Bob, who each
 * measure in randomly chosen bases. A subset of the results is used to evaluate
 * the CHSH Bell parameter S. Quantum mechanics predicts S as large as 2 times
 * the square root of two, above the classical bound of two, so an eavesdropper
 * that measures and resends the pairs necessarily lowers S and is detected.
 * The remaining pairs, measured in a shared basis, form the shared secret key.
 *
 * This is a deterministic teaching simulation. It samples correlated ±1
 * outcomes from the exact quantum joint probabilities, models eavesdropping as
 * an intercept-and-resend in a random basis, and uses a fixed pseudo-random
 * generator. It is NOT a real QKD implementation: there is no quantum channel,
 * no device-independent security proof, no authentication, and no privacy
 * amplification. Only the correlation statistics are faithful.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(pairs) sampled measurement outcomes
 *   Space: O(pairs) for the per-pair records
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid rows show the four CHSH basis settings and a shared-basis key row.
 *   - Each row reports same and different counts and its correlation E.
 *   - The final frame reports S and whether the Bell inequality is violated.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Setting {
    label: string;
    alice: number;
    bob: number;
}

const CHSH: Setting[] = [
    { label: "a1 b1", alice: 0, bob: Math.PI / 8 },
    { label: "a1 b2", alice: 0, bob: -Math.PI / 8 },
    { label: "a2 b1", alice: Math.PI / 4, bob: Math.PI / 8 },
    { label: "a2 b2", alice: Math.PI / 4, bob: -Math.PI / 8 },
];
const EVE_BASES = [0, Math.PI / 8, Math.PI / 4, -Math.PI / 8];

/** Sample the product of two ±1 outcomes for Phi-plus with measurement angles a and b. */
function sampleProduct(a: number, b: number, random: () => number, eavesdrop: boolean, delta: number): number {
    if (!eavesdrop) {
        return random() < Math.cos(a - b) ** 2 ? 1 : -1;
    }
    // Intercept-and-resend: Eve measures in a random basis and reprepares her outcome.
    const eveOutcome = random() < 0.5 ? 1 : -1;
    const ae = random() < Math.cos(a - delta) ** 2 ? eveOutcome : -eveOutcome;
    const eb = random() < Math.cos(delta - b) ** 2 ? eveOutcome : -eveOutcome;
    return ae * eb;
}

/** Build the result table cells. */
function makeCells(
    rows: Array<{ label: string; same: number; diff: number; E: number }>,
    visible: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < rows.length; r += 1) {
        const row = rows[r]!;
        const values = [row.label, row.same, row.diff, row.E];
        const labels = [row.label, String(row.same), String(row.diff), row.E.toFixed(4)];
        for (let col = 0; col < 4; col += 1) {
            let state: EntityState = "unvisited";
            if (r < visible) {
                state = r === 4 ? "sorted" : "comparing";
            }
            entities.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label: labels[col] ?? "",
                value: values[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, setting: row.label, same: row.same, diff: row.diff, E: row.E },
            });
        }
    }
    return entities;
}

/** The E91 generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { trialsPerSetting?: number; keyBits?: number; seed?: number; eavesdropper?: boolean } | null) ?? {};
    const trialsPerSetting = Math.min(20000, Math.max(20, Math.floor(Number(task.trialsPerSetting ?? 2000)) || 2000));
    const keyBits = Math.min(20000, Math.max(8, Math.floor(Number(task.keyBits ?? 64)) || 64));
    const seed = Math.floor(Number(task.seed ?? 11)) || 11;
    const eavesdropper = task.eavesdropper === true;
    const random = rng(seed);

    const rows: Array<{ label: string; same: number; diff: number; E: number }> = [];
    const correlations: number[] = [];
    for (const setting of CHSH) {
        let same = 0;
        let diff = 0;
        for (let t = 0; t < trialsPerSetting; t += 1) {
            const delta = EVE_BASES[Math.floor(random() * EVE_BASES.length)] ?? 0;
            const product = sampleProduct(setting.alice, setting.bob, random, eavesdropper, delta);
            if (product > 0) {
                same += 1;
            } else {
                diff += 1;
            }
        }
        const E = (same - diff) / (same + diff);
        correlations.push(E);
        rows.push({ label: setting.label, same, diff, E });
    }
    const S = Math.abs(
        (correlations[0] ?? 0) + (correlations[1] ?? 0) + (correlations[2] ?? 0) - (correlations[3] ?? 0),
    );

    let keySame = 0;
    let keyErrors = 0;
    for (let t = 0; t < keyBits; t += 1) {
        const delta = EVE_BASES[Math.floor(random() * EVE_BASES.length)] ?? 0;
        const product = sampleProduct(0, 0, random, eavesdropper, delta);
        if (product > 0) {
            keySame += 1;
        } else {
            keyErrors += 1;
        }
    }
    rows.push({
        label: "key 0 0",
        same: keySame,
        diff: keyErrors,
        E: (keySame - keyErrors) / (keySame + keyErrors),
    });
    const keyAgreement = keySame / keyBits;
    const violated = S > 2;

    const meta = (visible: number, done: boolean) => ({
        rows: 5,
        cols: 4,
        trialsPerSetting,
        keyBits,
        seed,
        eavesdropper,
        correlations: [...correlations],
        S,
        classicalBound: 2,
        tsirelsonBound: 2 * Math.SQRT2,
        violated,
        keyAgreement,
        keyErrors,
        visible,
        done,
        note: "deterministic E91 toy model: sampled quantum correlations and intercept-resend, no device-independent security proof",
    });

    yield {
        stepNumber: 0,
        entities: makeCells(rows, 0),
        edges: [],
        description: `E91 with ${trialsPerSetting} trials per CHSH setting and ${keyBits} key bits; eavesdropper ${eavesdropper ? "present" : "absent"}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(0, false),
    };
    let step = 1;

    for (let i = 0; i < CHSH.length; i += 1) {
        const row = rows[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(rows, i + 1),
            edges: [],
            description: `Setting ${row.label}: ${row.same} equal and ${row.diff} opposite outcomes, giving E = ${row.E.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(i + 1, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(rows, 5),
        edges: [],
        description: `Shared basis: ${keySame} agreeing and ${keyErrors} disagreeing key bit(s), agreement ${(keyAgreement * 100).toFixed(1)} percent.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: meta(5, false),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(rows, 5),
        edges: [],
        description: `CHSH S = ${S.toFixed(4)} versus classical bound 2; Bell inequality ${violated ? "violated, channel looks quantum" : "not violated, eavesdropping suspected"}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: meta(5, true),
    };
}

/** The E91 module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "E91 uses shared entangled pairs as a resource. Alice and Bob measure in several bases and combine the correlations into the CHSH number S. No local hidden-variable theory can make S exceed two, but entangled pairs reach about 2.83. An eavesdropper has to measure the pairs to learn anything, and that measurement destroys the delicate correlations, dragging S below the bound and exposing the intrusion. Pairs measured in a common basis then become the key.",
        invariants: [
            "For a Bell pair, the probability of equal ±1 outcomes at angles a and b is cos squared of a minus b.",
            "The four CHSH correlations combine as S equals E11 plus E12 plus E21 minus E22.",
            "Key bits come only from pairs measured in the same basis on both sides.",
        ],
        correctness:
            "For the Phi-plus state, measuring at angles a and b yields equal outcomes with probability cos squared of a minus b, so the average product is cos of twice the angle difference. With settings a1 = 0, a2 = pi/4, b1 = pi/8, b2 = -pi/8 the four correlations are each plus or minus the square root of two over two, giving S = 2 square root of two, which violates the classical bound of two. Intercept-and-resend in a random basis multiplies every correlation by one half, lowering S to about square root of two so the violation disappears. Meanwhile same-basis measurements are perfectly correlated without an attacker, so Alice and Bob share identical key bits.",
        complexityRationale:
            "Each of the four settings uses a fixed number of trials and the key uses a fixed number of bits, so the work is linear in the total number of pairs sampled, O(pairs). The per-pair outcomes are accumulated into counters, so only O(1) running state is kept beyond the displayed table.",
        uses: [
            "A teaching model for entanglement-based quantum key distribution",
            "Explaining Bell inequality tests and device-independent ideas",
            "Understanding why eavesdropping on entangled pairs is detectable",
        ],
        references: [
            "Ekert, Quantum Cryptography Based on Bell's Theorem, 1991",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 12",
        ],
        workedExample:
            "With two thousand trials per setting and no eavesdropper, each CHSH correlation is about 0.707, so S is about 2.83 and the Bell inequality is violated. The shared-basis key bits agree almost perfectly. With an intercept-and-resend attacker measuring in a random basis, the correlations are about 0.354, S falls to about 1.41, and the key shows errors, signaling that the run must be discarded.",
    },
    id: "e91-protocol",
    name: "E91 Protocol (Toy Model)",
    category: "quantum",
    complexity: { time: "O(pairs)", space: "O(1)" },
    defaultInput: { trialsPerSetting: 2000, keyBits: 64, seed: 11, eavesdropper: false },
    visualType: "grid",
    run,
    pseudocode: [
        "a source distributes entangled Bell pairs to Alice and Bob",
        "for each CHSH setting measure both sides in the chosen angles",
        "count equal and opposite outcomes to estimate that correlation E",
        "combine the four correlations into S equals E11 plus E12 plus E21 minus E22",
        "measure a shared-basis subset to obtain secret key bits",
        "if S exceeds two accept the channel and keep the key",
        "otherwise suspect eavesdropping and discard the run",
        "done: report S, the Bell verdict, and the key agreement rate",
    ],
};

export default module;
