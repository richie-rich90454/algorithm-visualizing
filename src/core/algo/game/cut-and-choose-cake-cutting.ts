/**
 * cut-and-choose-cake-cutting.ts - Cut and Choose Cake Cutting
 *
 * Two players divide a cake represented by equal-width segments with different
 * value densities. One player cuts at the point where she values the left
 * piece at exactly half her total, and the other player then chooses the piece
 * she values more. Because the cutter sees both halves as equal and the chooser
 * takes her favorite, the resulting two-piece division is envy-free.
 *
 * Time O(k) for k cake segments; space O(k).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function normalize(values: number[], k: number): number[] {
    const sum = values.reduce((a, b) => a + b, 0);
    return sum > 0 ? values.map((v) => (v * 100) / sum) : new Array<number>(k).fill(100 / k);
}

function valueUpTo(points: number[], k: number, x: number): number {
    const seg = Math.max(0, Math.min(k, x * k));
    let total = 0;
    for (let i = 0; i < k; i += 1) {
        const cover = Math.max(0, Math.min(1, seg - i));
        total += (points[i] ?? 0) * cover;
    }
    return total;
}

function findCut(points: number[], k: number): number {
    let acc = 0;
    let i = 0;
    while (i < k && acc + (points[i] ?? 0) < 50 - 1e-12) {
        acc += points[i] ?? 0;
        i += 1;
    }
    if (i >= k) return 1;
    const p = points[i] ?? 0;
    if (p <= 0) return i / k;
    return (i + (50 - acc) / p) / k;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { alice?: number[]; bob?: number[] } | null) ?? {};
    const rawAlice = Array.isArray(task.alice) && task.alice.length >= 2 && task.alice.length <= 10 ? task.alice : [10, 30, 40, 20];
    const rawBob = Array.isArray(task.bob) && task.bob.length === rawAlice.length ? task.bob : [30, 20, 10, 40];
    const k = rawAlice.length;
    const alice = normalize(rawAlice, k);
    const bob = normalize(rawBob, k);
    const cut = findCut(alice, k);
    const leftAlice = valueUpTo(alice, k, cut);
    const rightAlice = 100 - leftAlice;
    const leftBob = valueUpTo(bob, k, cut);
    const rightBob = 100 - leftBob;
    const chosen: "left" | "right" = leftBob >= rightBob ? "left" : "right";
    const aliceValue = chosen === "left" ? rightAlice : leftAlice;
    const bobValue = chosen === "left" ? leftBob : rightBob;
    const aliceOther = 100 - aliceValue;
    const bobOther = 100 - bobValue;

    const bars = (showCut: boolean): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < k; i += 1) {
            const cover = Math.max(0, Math.min(1, cut * k - i));
            out.push({
                id: `alice-${i}`,
                type: "bar",
                label: `A${i} ${(alice[i] ?? 0).toFixed(0)}`,
                value: alice[i] ?? 0,
                state: (showCut && cover > 0 && cover < 1 ? "comparing" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { party: "alice", segment: i, points: alice[i] ?? 0, fractionLeft: cover },
            });
            out.push({
                id: `bob-${i}`,
                type: "bar",
                label: `B${i} ${(bob[i] ?? 0).toFixed(0)}`,
                value: bob[i] ?? 0,
                state: (chosen === "left" ? (cover > 0 ? "sorted" : "idle") : (cover < 1 ? "sorted" : "idle")) as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { party: "bob", segment: i, points: bob[i] ?? 0, fractionLeft: cover },
            });
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(false),
        edges: [],
        description: `Cut and choose on a ${k}-segment cake; Alice marks ${alice.map((v) => v.toFixed(0)).join("/")} and Bob marks ${bob.map((v) => v.toFixed(0)).join("/")} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { segments: k, alice: [...alice], bob: [...bob], cut: -1 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(true),
        edges: [],
        description: `Alice cuts at ${cut.toFixed(3)} where her cumulative value reaches ${leftAlice.toFixed(1)} points, exactly half the cake.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { segments: k, cut, leftAlice, rightAlice, leftBob, rightBob, alice: [...alice], bob: [...bob] },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(true),
        edges: [],
        description: `Bob values the left piece at ${leftBob.toFixed(1)} and the right at ${rightBob.toFixed(1)}, so he takes the ${chosen} piece.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { segments: k, cut, chosen, leftBob, rightBob, bobValue, bobOther },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(true),
        edges: [],
        description: `Alice receives the ${chosen === "left" ? "right" : "left"} piece worth ${aliceValue.toFixed(1)} to her and Bob receives ${bobValue.toFixed(1)}; neither envies the other.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            segments: k, alice: [...alice], bob: [...bob], cut, chosen,
            aliceValue, bobValue, aliceOther, bobOther,
            leftAlice, rightAlice, leftBob, rightBob,
            envyFree: aliceValue >= aliceOther - 1e-9 && bobValue >= bobOther - 1e-9,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The simplest fair division protocol is cut and choose. One player slices the cake so that, in her own eyes, both pieces are equal; the other player then picks whichever piece she likes better. The cutter cannot complain because she sees the halves as identical, and the chooser cannot complain because she took the piece she valued more.",
        invariants: [
            "The two pieces cover the whole cake and do not overlap.",
            "The cutter's cumulative value at the cut is exactly half her total.",
            "The chooser selects the piece with the larger value to her.",
        ],
        correctness:
            "The cut is found by walking segments until the cumulative value reaches half the total, then interpolating inside the crossing segment, so the cutter values each piece at exactly fifty points. The chooser compares her own values of the two pieces and keeps the larger, which is at least half her total. The cutter receives the other piece, which she values exactly as much as the piece the chooser took, so neither player prefers the other's allocation; the division is envy-free.",
        complexityRationale:
            "Finding the crossing segment and evaluating a cumulative value function each scan the k segments once, giving O(k) time and O(k) space for the displayed value table.",
        uses: [
            "Splitting an asset between two heirs or partners",
            "Introducing the concept of envy-free fair division",
            "Building block for multi-player cake cutting protocols",
        ],
        references: [
            "Steinhaus, The Problem of Fair Division (1948)",
            "Brams and Taylor, Fair Division: From Cake Cutting to Dispute Resolution (1996)",
        ],
        workedExample:
            "Alice values four equal segments at 10, 30, 40, 20 and Bob at 30, 20, 10, 40. Alice reaches fifty points just inside segment two, so she cuts there; Bob values the left piece more and chooses it, leaving Alice a piece she also values at fifty and giving both an envy-free share.",
    },
    id: "cut-and-choose-cake-cutting",
    name: "Cut and Choose Cake Cutting",
    category: "game",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { alice: [10, 30, 40, 20], bob: [30, 20, 10, 40] },
    visualType: "array",
    run,
    pseudocode: [
        "normalize both players' segment values to 100 points",
        "walk the cake accumulating the cutter's value",
        "interpolate the cut where the accumulator reaches 50",
        "evaluate the chooser's value of the left piece",
        "give the chooser the piece she values more",
        "give the cutter the remaining piece",
        "report the cut, selection, and envy-free verdict",
    ],
};

export default module;
