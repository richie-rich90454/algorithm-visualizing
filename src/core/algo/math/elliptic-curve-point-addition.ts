import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function N(
    id: string,
    label: string,
    x: number,
    y: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [x, y],
        state,
        x: x * 30,
        y: -y * 30,
        width: 0,
        height: 0,
        metadata: { index: id },
    };
}
/**
 * elliptic-curve-point-addition – EC Point Addition.
 * Chord-and-tangent on y^2 = x^3+2x+2 over F_17.
 * Default P(5,1)+Q(6,3) = R(10,6). Time O(log p), space O(1).
 */
function modInv(a: number, p: number): number {
    const v = ((a % p) + p) % p;
    for (let x = 1; x < p; x += 1) if ((v * x) % p === 1) return x;
    return 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { px?: number; py?: number; qx?: number; qy?: number } | null) ?? {};
    const px = typeof t.px === "number" ? Math.trunc(t.px) : 5;
    const py = typeof t.py === "number" ? Math.trunc(t.py) : 1;
    const qx = typeof t.qx === "number" ? Math.trunc(t.qx) : 6;
    const qy = typeof t.qy === "number" ? Math.trunc(t.qy) : 3;
    const p = 17,
        A = 2,
        B = 2;
    let step = 0;
    const onCurve = (x: number, y: number): boolean =>
        (((y * y) % p) + p) % p === (((((x * x) % p) * x + A * x + B) % p) + p) % p;
    if (!onCurve(px, py) || !onCurve(qx, qy)) {
        yield {
            stepNumber: 0,
            entities: [N("P", `P(${px},${py})`, px, py, "highlight")],
            edges: [],
            description: `Point off curve – degenerate input.`,
            codeLineNumber: 0,
            layout: "point",
            meta: {},
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [N("P", `P(${px},${py})`, px, py, "comparing")],
        edges: [],
        description: `Curve y^2 = x^3+2x+2 over F_17; P = (${px},${py}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            N("P", `P(${px},${py})`, px, py, "idle"),
            N("Q", `Q(${qx},${qy})`, qx, qy, "comparing"),
        ],
        edges: [],
        description: `Q = (${qx},${qy}) – draw the chord P-Q.`,
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;
    if (px === qx && (py + qy) % p === 0) {
        yield {
            stepNumber: step,
            entities: [
                N("P", `P(${px},${py})`, px, py, "swapped"),
                N("Q", `Q(${qx},${qy})`, qx, qy, "swapped"),
            ],
            edges: [],
            description: `Vertical chord – sum is the point at infinity.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { infinity: true },
        };
        return;
    }
    let lam: number;
    if (px === qx) {
        const den = (2 * py) % p;
        if (((den % p) + p) % p === 0) {
            yield {
                stepNumber: step,
                entities: [N("P", `P(${px},${py})`, px, py, "swapped")],
                edges: [],
                description: `Tangent vertical – sum is infinity.`,
                codeLineNumber: 2,
                layout: "point",
                meta: { infinity: true },
            };
            return;
        }
        lam = (((((3 * px * px + A) % p) * modInv(den, p)) % p) + p) % p;
    } else {
        lam = (((((qy - py) % p) + p) % p) * modInv((((qx - px) % p) + p) % p, p)) % p;
    }
    yield {
        stepNumber: step,
        entities: [
            N("P", `P(${px},${py})`, px, py, "comparing"),
            N("Q", `Q(${qx},${qy})`, qx, qy, "comparing"),
        ],
        edges: [],
        description: `Slope λ = ${lam} mod ${p}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { lam },
    };
    step += 1;
    const rx = (((lam * lam - px - qx) % p) + p) % p;
    const ry = (((lam * (px - rx) - py) % p) + p) % p;
    yield {
        stepNumber: step,
        entities: [
            N("P", `P(${px},${py})`, px, py, "idle"),
            N("Q", `Q(${qx},${qy})`, qx, qy, "idle"),
            N("R", `R(${rx},${ry})`, rx, ry, "highlight"),
        ],
        edges: [],
        description: `R = (${rx},${ry}): x = λ^2-Px-Qx, y = λ(Px-Rx)-Py.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { rx, ry },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [
            N("P", `P(${px},${py})`, px, py, "idle"),
            N("Q", `Q(${qx},${qy})`, qx, qy, "idle"),
            N("R", `R(${rx},${ry})`, rx, ry, "sorted"),
        ],
        edges: [],
        description: onCurve(rx, ry)
            ? `R lies on the curve – P+Q = (${rx},${ry}).`
            : `R off curve – stopping honestly.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { rx, ry, ok: onCurve(rx, ry) },
    };
}
const module: AlgorithmModule = {
    id: "elliptic-curve-point-addition",
    name: "Elliptic Curve Point Addition",
    category: "math",
    complexity: { time: "O(log p)", space: "O(1)" },
    defaultInput: { px: 5, py: 1, qx: 6, qy: 3 },
    visualType: "point",
    run,
};
export default module;
