/**
 * adjusted-winner-procedure.ts - Adjusted Winner Procedure
 *
 * Two parties first mark 100 points across a set of disputed items, and each
 * item goes to the party who values it more. If one party ends up with more
 * points, items are transferred from the leader to the follower in order of
 * increasing ratio of the leader's value to the follower's value. The last
 * item is split so that both parties receive exactly the same number of their
 * own points. The result is equitable and envy-free for two parties.
 *
 * Time O(k log k) for k items; space O(k).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Party = "bob" | "carol";

interface Solution {
    bobShare: number[];
    carolShare: number[];
    bobPoints: number;
    carolPoints: number;
    leader: Party;
    initialBob: number;
    initialCarol: number;
    steps: Array<{ item: number; fraction: number; whole: boolean; gap: number }>;
}

function normalize(points: number[]): number[] {
    const sum = points.reduce((a, b) => a + b, 0);
    return sum > 0 ? points.map((v) => (v * 100) / sum) : points.map(() => 0);
}

function solve(rawBob: number[], rawCarol: number[]): Solution {
    const bob = normalize(rawBob);
    const carol = normalize(rawCarol);
    const k = bob.length;
    const bobShare = new Array<number>(k).fill(0);
    const carolShare = new Array<number>(k).fill(0);

    for (let i = 0; i < k; i += 1) {
        if ((bob[i] ?? 0) >= (carol[i] ?? 0)) bobShare[i] = 1;
        else carolShare[i] = 1;
    }

    let bobPoints = bob.reduce((s, v, i) => s + v * (bobShare[i] ?? 0), 0);
    let carolPoints = carol.reduce((s, v, i) => s + v * (carolShare[i] ?? 0), 0);
    const initialBob = bobPoints;
    const initialCarol = carolPoints;
    const leader: Party = bobPoints >= carolPoints ? "bob" : "carol";

    const held = bob
        .map((_, i) => i)
        .filter((i) => (leader === "bob" ? bobShare[i] === 1 : carolShare[i] === 1))
        .sort((x, y) => {
            const lx = leader === "bob" ? (bob[x] ?? 0) : (carol[x] ?? 0);
            const fx = leader === "bob" ? (carol[x] ?? 0) : (bob[x] ?? 0);
            const ly = leader === "bob" ? (bob[y] ?? 0) : (carol[y] ?? 0);
            const fy = leader === "bob" ? (carol[y] ?? 0) : (bob[y] ?? 0);
            const rx = fx === 0 ? Infinity : lx / fx;
            const ry = fy === 0 ? Infinity : ly / fy;
            return rx - ry || x - y;
        });

    const steps: Solution["steps"] = [];
    let gap = Math.abs(bobPoints - carolPoints);
    for (const i of held) {
        if (gap <= 1e-12) break;
        const lval = leader === "bob" ? (bob[i] ?? 0) : (carol[i] ?? 0);
        const fval = leader === "bob" ? (carol[i] ?? 0) : (bob[i] ?? 0);
        const span = lval + fval;
        if (span <= 0) continue;
        const whole = gap > span + 1e-12;
        const fraction = whole ? 1 : gap / span;
        bobShare[i] = (bobShare[i] ?? 0) + (leader === "carol" ? fraction : -fraction);
        carolShare[i] = (carolShare[i] ?? 0) + (leader === "bob" ? fraction : -fraction);
        bobPoints = bob.reduce((s, v, j) => s + v * (bobShare[j] ?? 0), 0);
        carolPoints = carol.reduce((s, v, j) => s + v * (carolShare[j] ?? 0), 0);
        steps.push({ item: i, fraction, whole, gap });
        gap = Math.abs(bobPoints - carolPoints);
    }

    return { bobShare, carolShare, bobPoints, carolPoints, leader, initialBob, initialCarol, steps };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { bob?: number[]; carol?: number[] } | null) ?? {};
    const rawBob = Array.isArray(task.bob) && task.bob.length >= 2 ? task.bob : [50, 30, 20];
    const rawCarol = Array.isArray(task.carol) && task.carol.length === rawBob.length ? task.carol : [20, 40, 40];
    const bob = normalize(rawBob);
    const carol = normalize(rawCarol);
    const k = bob.length;
    const sol = solve(rawBob, rawCarol);
    const active = new Set<number>();

    const bars = (): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < k; i += 1) {
            const bv = (bob[i] ?? 0) * (sol.bobShare[i] ?? 0);
            const cv = (carol[i] ?? 0) * (sol.carolShare[i] ?? 0);
            out.push({
                id: `bob-${i}`,
                type: "bar",
                label: `B item${i} ${bv.toFixed(1)}`,
                value: bv,
                state: (active.has(i) ? "comparing" : bv > 0 ? "sorted" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { party: "bob", item: i, share: sol.bobShare[i] ?? 0 },
            });
            out.push({
                id: `carol-${i}`,
                type: "bar",
                label: `C item${i} ${cv.toFixed(1)}`,
                value: cv,
                state: (active.has(i) ? "comparing" : cv > 0 ? "sorted" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { party: "carol", item: i, share: sol.carolShare[i] ?? 0 },
            });
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Adjusted winner with ${k} items; Bob marks ${bob.join("/")} and Carol marks ${carol.join("/")} points.`,
        codeLineNumber: 0,
        layout: "array",
        meta: {
            items: k, bob: [...bob], carol: [...carol], leader: sol.leader,
            initialBob: sol.initialBob, initialCarol: sol.initialCarol,
            bobShare: [...sol.bobShare], carolShare: [...sol.carolShare],
        },
    };
    step += 1;

    for (const s of sol.steps) {
        active.clear();
        active.add(s.item);
        yield {
            stepNumber: step,
            entities: bars(),
            edges: [],
            description: `${s.whole ? "Transferring whole" : "Splitting"} item ${s.item}: the leader gives fraction ${s.fraction.toFixed(3)} to close a gap of ${s.gap.toFixed(2)} points.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                item: s.item, fraction: s.fraction, whole: s.whole, gap: s.gap,
                bobShare: [...sol.bobShare], carolShare: [...sol.carolShare],
            },
        };
        step += 1;
    }
    active.clear();

    const bobBundle = bob.reduce((s, v, i) => s + v * (sol.bobShare[i] ?? 0), 0);
    const carolBundle = carol.reduce((s, v, i) => s + v * (sol.carolShare[i] ?? 0), 0);
    const bobOfCarol = bob.reduce((s, v, i) => s + v * (sol.carolShare[i] ?? 0), 0);
    const carolOfBob = carol.reduce((s, v, i) => s + v * (sol.bobShare[i] ?? 0), 0);
    const envyFree = bobBundle >= bobOfCarol - 1e-9 && carolBundle >= carolOfBob - 1e-9;
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Both parties receive ${sol.bobPoints.toFixed(2)} of their own points; the split is equitable and ${envyFree ? "envy-free" : "contested"}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            bob: [...bob], carol: [...carol], leader: sol.leader,
            initialBob: sol.initialBob, initialCarol: sol.initialCarol,
            bobPoints: sol.bobPoints, carolPoints: sol.carolPoints,
            bobBundle, carolBundle, bobOfCarol, carolOfBob, envyFree,
            bobShare: [...sol.bobShare], carolShare: [...sol.carolShare],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each party secretly distributes 100 points over the items, and every item first goes to whoever values it more. When one side has more points, we hand back the items that cost the leader little but give the follower a lot, splitting one item at the end. Both sides then receive the same number of their own points and neither wants the other's bundle.",
        invariants: [
            "Every item's two shares always sum to one.",
            "Each transferred item comes from the party currently leading in points.",
            "The point gap shrinks by the leader's value plus the follower's value for each item transferred.",
        ],
        correctness:
            "Initially the leader's total exceeds the follower's by a gap D. Transferring a whole item removes exactly the sum of the two valuations from D, and we stop at the first item whose combined value meets or exceeds D. Splitting that item with fraction D divided by the combined value closes the remaining gap exactly, so both final point totals are equal. Because items are returned in increasing ratio of leader value to follower value, each party values its own final bundle at least as much as the other's, giving envy-freeness.",
        complexityRationale:
            "Sorting the leader's held items by their value ratio costs O(k log k), and the subsequent single pass plus point recomputation is O(k) per transfer, so the dominant term is the sort with O(k) space for the shares.",
        uses: [
            "Two-party divorce and partnership asset division",
            "Negotiated allocation of intellectual property or territory",
            "Teaching equitable and envy-free fair division",
        ],
        references: [
            "Brams and Taylor, The Win-Win Solution: Guaranteeing Fair Shares to Everybody (1999)",
            "Brams and Taylor, An envy-free cake division protocol (1995)",
        ],
        workedExample:
            "Bob marks items 50/30/20 and Carol marks 20/40/40. Initially Bob gets item 0 (50) and Carol gets items 1 and 2 (80). Carol leads by 30, so she returns item 1; splitting it with fraction 30 divided by 70 gives each party about 62.86 of their own points, and neither prefers the other's share.",
    },
    id: "adjusted-winner-procedure",
    name: "Adjusted Winner Procedure",
    category: "game",
    complexity: { time: "O(k log k)", space: "O(k)" },
    defaultInput: { bob: [50, 30, 20], carol: [20, 40, 40] },
    visualType: "array",
    run,
    pseudocode: [
        "normalize each party's marks to 100 points",
        "award each item to the party who valued it more",
        "identify the leader and the current point gap",
        "sort the leader's items by increasing leader-to-follower value ratio",
        "transfer whole items while the gap exceeds an item's combined value",
        "split the next item by the gap over its combined value",
        "report the equitable, envy-free allocation",
    ],
};

export default module;
