/**
 * sobol-sequence.ts - Two-Dimensional Sobol Low-Discrepancy Sequence.
 *
 * A Sobol sequence fills the unit square evenly: each new point lands in the
 * largest gap left so far. Coordinates are built by XOR-ing integer direction
 * numbers selected by the set bits of the point index. The first dimension uses
 * the base-two radical inverse; the second uses direction numbers generated
 * from the primitive polynomial x^2 + x + 1.
 *
 * Time:  O(n * log n) for n points with 32-bit direction numbers
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

const BITS = 32;
const SCALE = 4294967296;

/** First-dimension direction numbers: d_k = 2^(31-k). */
const dim1 = Array.from({ length: BITS }, (_, k) => (2 ** (31 - k)) >>> 0);

/** Second-dimension direction numbers from primitive polynomial x^2 + x + 1. */
const dim2 = (() => {
    const m: number[] = [1, 1];
    for (let k = 2; k < BITS; k += 1) {
        m[k] = (2 * (m[k - 1] as number)) ^ (5 * (m[k - 2] as number));
    }
    return m.map((mk, k) => (mk * 2 ** (31 - k)) >>> 0);
})();

function coordinate(index: number, directions: number[]): number {
    let value = 0;
    let i = index;
    let k = 0;
    while (i > 0) {
        if ((i & 1) === 1) {
            value = (value ^ (directions[k] as number)) >>> 0;
        }
        i = Math.floor(i / 2);
        k += 1;
    }
    return value / SCALE;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number } | null) ?? {};
    const count = Math.max(1, Math.min(512, task.count ?? 32));

    const points: Array<[number, number]> = [];
    for (let i = 0; i < count; i += 1) {
        points.push([coordinate(i, dim1), coordinate(i, dim2)]);
    }

    const entitiesFor = (visible: number): VisualEntity[] => {
        const entities: VisualEntity[] = points.slice(0, visible).map(([x, y], i) => ({
            id: `p-${i}`,
            type: "node" as const,
            label: String(i),
            value: [x, y],
            state: i === visible - 1 ? ("active" as const) : ("unvisited" as const),
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        if (entities.length === 0) {
            entities.push({
                id: "origin",
                type: "node" as const,
                label: "(0,0)",
                value: [0, 0],
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { index: 0 },
            });
        }
        return entities;
    };

    let step = 0;
    const emit = (message: string, codeLine: number, visible: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const frame: VisualFrame = {
            stepNumber: step,
            entities: entitiesFor(visible),
            edges: [],
            description: message,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
        step += 1;
        return frame;
    };

    yield emit(`Generating ${count} Sobol points in the unit square; point 0 is always the origin.`, 0, 0, { count, placed: 0, xs: [], ys: [] });

    for (let i = 0; i < count; i += 1) {
        const [x, y] = points[i] as [number, number];
        yield emit(
            `Point ${i}: index ${i} has set bits selecting direction numbers, giving (${x.toFixed(4)}, ${y.toFixed(4)}).`,
            i === 0 ? 1 : 4,
            i + 1,
            { count, placed: i + 1, xs: points.slice(0, i + 1).map((p) => p[0]), ys: points.slice(0, i + 1).map((p) => p[1]) },
        );
    }

    yield emit(`Done: ${count} Sobol points spread evenly over the unit square with low discrepancy.`, 6, count, { count, placed: count, xs: points.map((p) => p[0]), ys: points.map((p) => p[1]) });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Sobol sequence is a recipe for scattering points so that no region is left empty and no region gets crowded. Instead of drawing random coordinates, it looks at the binary digits of the point number and XORs together a fixed table of direction numbers. The result is a surprisingly even spread that is also reproducible, which is valuable when a simulation must be repeated exactly.",
        invariants: [
            "The zero-th point is always the origin.",
            "Every coordinate lies in the half-open unit interval [0, 1).",
            "A point is the XOR of direction numbers indexed by the set bits of its index.",
        ],
        correctness:
            "Each dimension maps the index through a set of direction numbers whose binary fractions are uniformly distributed modulo one, so the resulting coordinates are uniformly distributed; using a primitive polynomial for the second dimension makes the two dimensions jointly uniform. XOR is a bijection on fixed-width bit patterns, so distinct indices always give distinct points, and the maximum value is below one because all direction numbers are 32-bit fractions.",
        complexityRationale:
            "For each point, the loop examines at most log2(index) bits, each a constant-time XOR, so generating n points costs O(n log n). Storing the generated coordinates takes O(n) space; the fixed 32-entry direction tables use constant space.",
        uses: [
            "Quasi-Monte Carlo integration with faster convergence than random sampling",
            "Computer graphics sampling for soft shadows and global illumination",
            "Reproducible financial and scientific simulations",
        ],
        references: [
            "I. M. Sobol, On the Distribution of Points in a Cube and the Accurate Evaluation of Integrals, 1967",
            "S. Joe and Y. Kuo, Constructing Sobol Sequences with Better Two-Dimensional Projections, 2008",
        ],
        workedExample:
            "Index 0 has no set bits, so both coordinates are zero and the first point is (0, 0). Index 1 selects only the first direction number in each dimension, which is one half, giving (0.5, 0.5). Index 2 selects the second direction number, one quarter, giving (0.25, 0.25). These points quickly split the square into roughly equal quadrants.",
    },
    id: "sobol-sequence",
    name: "Sobol Sequence",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { count: 32 },
    visualType: "point",
    run,
    pseudocode: [
        "build direction numbers for the first dimension as powers of one half",
        "build second-dimension numbers from primitive polynomial x squared plus x plus one",
        "for each point index from zero upward",
        "start the coordinate at zero and scan the index bits",
        "for every set bit XOR in the matching direction number",
        "divide the 32-bit result by two to the 32 to get a fraction",
        "place the point at the two resulting coordinates",
        "done: return the full low-discrepancy point set",
    ],
};

export default module;
