/**
 * device-independent-qkd.ts - Device-Independent QKD (CHSH test)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Device-independent quantum key distribution certifies secrecy from observed
 * measurement statistics rather than from a trusted model of the hardware.
 * The Ekert-style protocol shares Bell pairs, chooses random measurement axes,
 * and evaluates the CHSH correlation combination S. Any local realistic model
 * obeys |S| at most 2, while an ideal shared pair reaches 2 times the square
 * root of 2. Observing a large violation certifies nonlocality, and an
 * intercept-resend eavesdropper lowers S below the local bound and is detected.
 *
 * Limits: this is an exact small simulation of correlators for a single Bell
 * pair measured in the X-Z plane. It does not model finite-key statistics,
 * detector loopholes, authentication, or more than one eavesdropper strategy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for the four correlators
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the four CHSH correlators under each scenario.
 *   - The winning setting is gold and the local bound is shown in meta.
 *   - meta carries S values, the local bound, and the security verdict.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const A0 = 0;
const A1 = Math.PI / 2;
const B0 = Math.PI / 4;
const B1 = (3 * Math.PI) / 4;

/** Correlation of a Bell pair measured at angles in the X-Z plane. */
function bellCorrelation(thetaA: number, thetaB: number): number {
    return Math.cos(thetaA - thetaB);
}

/** Correlation after an eavesdropper measures one qubit at angle phi. */
function interceptedCorrelation(thetaA: number, thetaB: number, phi: number): number {
    return Math.cos(thetaA - phi) * Math.cos(phi - thetaB);
}

/** CHSH combination using Alice settings a0,a1 and Bob settings b0,b1. */
function chsh(e00: number, e01: number, e10: number, e11: number): number {
    return e00 - e01 + e10 + e11;
}

function correlators(kind: "ideal" | "local" | "eve", phi: number): number[] {
    if (kind === "local") return [1, -1, 1, -1];
    const fn = kind === "ideal" ? bellCorrelation : (a: number, b: number) => interceptedCorrelation(a, b, phi);
    return [fn(A0, B0), fn(A0, B1), fn(A1, B0), fn(A1, B1)];
}

function makeBars(values: number[], labels: string[], hot: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `${labels[index]} ${value.toFixed(3)}`,
        value,
        state: hot && index === 0 ? "comparing" : hot ? "sorted" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, setting: labels[index] ?? "", correlation: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { eveAngle?: number } | null) ?? {};
    const phi = Number.isFinite(Number(task.eveAngle)) ? Number(task.eveAngle) : 0;

    const ideal = correlators("ideal", phi);
    const local = correlators("local", phi);
    const eve = correlators("eve", phi);
    const sIdeal = chsh(ideal[0]!, ideal[1]!, ideal[2]!, ideal[3]!);
    const sLocal = chsh(local[0]!, local[1]!, local[2]!, local[3]!);
    const sEve = chsh(eve[0]!, eve[1]!, eve[2]!, eve[3]!);
    const quantumBound = 2 * Math.SQRT2;
    const secure = sIdeal > 2 && sEve < 2;

    const metaFor = (s: number, scenario: string) => ({
        scenario,
        correlators: ideal.slice(),
        s,
        sIdeal,
        sLocal,
        sEve,
        localBound: 2,
        quantumBound,
        eveAngle: phi,
        keyQber: 0,
        secure,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars([0, 0, 0, 0], ["a0 b0", "a0 b1", "a1 b0", "a1 b1"], false),
        edges: [],
        description: "Set up a shared Bell pair and four random measurement-axis combinations.",
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, "setup"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(ideal, ["a0 b0", "a0 b1", "a1 b0", "a1 b1"], true),
        edges: [],
        description: `Ideal correlations give S = ${sIdeal.toFixed(4)}, above the local bound of 2.`,
        codeLineNumber: 2,
        layout: "array",
        meta: metaFor(sIdeal, "ideal"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(local, ["a0 b0", "a0 b1", "a1 b0", "a1 b1"], true),
        edges: [],
        description: `Any deterministic local model reaches at most S = ${sLocal.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: metaFor(sLocal, "local"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(eve, ["a0 b0", "a0 b1", "a1 b0", "a1 b1"], true),
        edges: [],
        description: `An intercept-resend attack at angle ${phi.toFixed(3)} collapses S to ${sEve.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: metaFor(sEve, "intercept-resend"),
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars([sIdeal, sLocal, sEve], ["ideal", "local", "eavesdrop"], false),
        edges: [],
        description: secure
            ? `Violation confirmed: S = ${sIdeal.toFixed(3)} exceeds 2 and the attack S = ${sEve.toFixed(3)} does not, so the key is certified.`
            : `No usable violation: the attack was not detected at this angle.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaFor(sIdeal, "verdict"),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two entangled particles give answers that are more strongly correlated than any pre-agreed local instructions could explain. The CHSH score adds four such correlations with alternating signs. Classical strategies cap the score at two, but a shared Bell pair reaches about 2.83, so a large observed score certifies that the devices really shared nonlocal correlations. An eavesdropper who measures the particles in transit destroys that extra correlation and gets caught by the same test.",
        invariants: [
            "Each single-qubit outcome is unbiased, so neither party alone can read the key.",
            "A local realistic strategy satisfies the CHSH bound of two in absolute value.",
            "The ideal Bell correlations are cosines of the angle difference between measurement axes.",
        ],
        correctness:
            "For the singlet-style correlations of a Bell pair measured in a plane, the joint expectation of outcomes is the cosine of the angle between axes. Substituting the four CHSH settings gives four values of plus or minus one over the square root of two, and their signed sum is two times the square root of two, the Tsirelson bound. Tsirelson's theorem shows no quantum strategy exceeds it, while Fine's theorem shows every local hidden-variable model stays within two. Intercept resend replaces one cosine by a product of two cosines, shrinking the score below two for every eavesdropping angle, which is exactly the detection signal.",
        complexityRationale:
            "Only four cosine correlations and a handful of additions are evaluated, so time and space are constant. The visualization adds a fixed number of frames.",
        uses: [
            "Certifying randomness and keys from untrusted measurement devices",
            "Ekert entanglement-based quantum key distribution",
            "Experimental tests of Bell inequalities and local realism",
        ],
        references: [
            "Ekert, Quantum Cryptography Based on Bell's Theorem, 1991",
            "Nielsen and Chuang, Quantum Computation and Quantum Information, Chapter 2",
        ],
        workedExample:
            "With Alice axes at 0 and 90 degrees and Bob axes at 45 and 135 degrees, the ideal Bell correlations are 0.707, minus 0.707, 0.707, and 0.707. Their signed sum is 2.828. A deterministic local model reaches 2, and an eavesdropper measuring at 0 degrees collapses the score to about 1.414, which is detected.",
    },
    id: "device-independent-qkd",
    name: "Device-Independent QKD (CHSH)",
    category: "quantum",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { eveAngle: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "share entangled Bell pairs between Alice and Bob",
        "choose random measurement axes from two settings each",
        "estimate the four correlators from matched outcome pairs",
        "compute S as E00 minus E01 plus E10 plus E11",
        "compare with the local realistic bound of two",
        "model intercept resend and recompute S for the attack",
        "accept the key only if the observed S violates the bound",
        "done: report S values and the security verdict",
    ],
};

export default module;
