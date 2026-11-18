import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function B(i: number, label: string, value: number, state: EntityState = "idle"): VisualEntity {
    return {
        id: `bar-${i}`,
        type: "bar" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    };
}
/**
 * farey-sequence – Farey Sequence by Mediant Insertion.
 * Repeatedly inserts mediants with denominator <= order.
 * Default order 4: 0/1..1/1 (7 terms). Time O(n^2).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { order?: number } | null) ?? {};
    const order = typeof t.order === "number" ? Math.trunc(t.order) : 4;
    let step = 0;
    if (!(order >= 1) || order > 8) {
        yield {
            stepNumber: 0,
            entities: [B(0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 1 <= order <= 8).`,
            codeLineNumber: 0,
            layout: "array",
            meta: { step },
        };
        return;
    }
    let seq: Array<[number, number]> = [
        [0, 1],
        [1, 1],
    ];
    const bars = (hot: number, desc: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: seq.map(([a, b], i) =>
            B(i, `${a}/${b}`, a / b, i === hot ? "comparing" : "idle"),
        ),
        edges: [],
        description: desc,
        codeLineNumber: line,
        layout: "array",
        meta: { step },
    });
    yield bars(-1, `Farey start: 0/1, 1/1.`, 0);
    step += 1;
    for (let pass = 0; pass < 6; pass += 1) {
        let added = false;
        const next: Array<[number, number]> = [];
        for (let i = 0; i < seq.length - 1; i += 1) {
            next.push(seq[i] as [number, number]);
            const [a, b] = seq[i] as [number, number];
            const [c, d] = seq[i + 1] as [number, number];
            if (b + d <= order) {
                next.push([a + c, b + d]);
                added = true;
            }
        }
        next.push(seq[seq.length - 1] as [number, number]);
        seq = next;
        yield {
            stepNumber: step,
            entities: seq.map(([a, b], i) => B(i, `${a}/${b}`, a / b, "comparing")),
            edges: [],
            description: `Pass ${pass + 1}: [${seq.map(([a, b]) => `${a}/${b}`).join(", ")}].`,
            codeLineNumber: 1,
            layout: "array",
            meta: { step },
        };
        step += 1;
        if (!added || step > 10) break;
    }
    yield {
        stepNumber: step,
        entities: seq.map(([a, b], i) => B(i, `${a}/${b}`, a / b, "sorted")),
        edges: [],
        description: `Farey(${order}): ${seq.length} terms.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { count: seq.length },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "The Farey sequence of order n lists all reduced fractions between 0 and 1 whose denominators are at most n, in increasing order. A classic construction repeatedly inserts the mediant of adjacent fractions, (a+c)/(b+d), whenever its denominator fits the order. Because mediants fall between their parents and preserve reducedness, the list grows in sorted order.",
        "invariants": [
            "All fractions remain in reduced form with denominator at most the order.",
            "Adjacent fractions a/b and c/d satisfy bc - ad = 1.",
            "The sequence is sorted between the sentinels 0/1 and 1/1."
        ],
        "correctness": "The mediant of two adjacent Farey fractions is the fraction with smallest denominator lying between them, and its denominator is the sum of the parents' denominators. Inserting it when that denominator is within the order therefore adds exactly the missing fractions. Repeating until no mediant fits yields the complete sorted Farey sequence.",
        "complexityRationale": "The order-n Farey sequence has Theta(n^2) terms and each insertion scans adjacent pairs, giving O(n^2) time and O(n^2) space for the stored list.",
        "uses": [
            "Enumerating reduced rational approximations with bounded denominator",
            "Studying Ford circles and continued fractions",
            "Generating test data for rational arithmetic"
        ],
        "references": [
            "Hardy and Wright, An Introduction to the Theory of Numbers, Chapter 3",
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 6"
        ],
        "workedExample": "Starting from 0/1 and 1/1 with order 4, insert mediants 1/2, then 1/3 and 2/3, then 1/4 and 3/4. The sequence 0/1, 1/4, 1/3, 1/2, 2/3, 3/4, 1/1 is the Farey sequence of order 4."
    },
    id: "farey-sequence",
    name: "Farey Sequence",
    category: "math",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { order: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "start from the endpoints 0/1 and 1/1",
        "insert each mediant whose denominator fits the order",
        "done: Farey(order) with count terms",
        "fractions stay sorted between 0 and 1",
        "done: passes end when no mediant fits",
    ],
};
export default module;
