/**
 * barnes-hut-simulation.ts - Barnes-Hut N-Body Force Approximation
 *
 * Approximates the mutual forces in an N-body system by grouping distant
 * particles into a tree node and replacing the group by its center of mass.
 * A node is accepted whenever its spatial size divided by the distance to the
 * target is below the opening angle theta; otherwise the traversal descends
 * into its children. With theta equal to zero the method reduces to the exact
 * direct summation of all pairwise forces.
 *
 * Limits of the demo: the problem is one dimensional, the tree is a balanced
 * binary tree over sorted positions, positions and masses are supplied
 * explicitly, one force evaluation per target is shown, and no time stepping
 * or leapfrog integration is performed. A softening length avoids division by
 * zero. Only Newtonian inverse-square forces are modeled.
 *
 * Time: O(N log N) per full evaluation for theta greater than zero.
 * Space: O(N) for the tree.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Particle {
    x: number;
    m: number;
}

interface Node {
    lo: number;
    hi: number;
    mass: number;
    com: number;
    left: Node | null;
    right: Node | null;
    index: number;
}

/** Build a balanced binary tree over particles sorted by position. */
export function buildTree(particles: Particle[], lo: number, hi: number): Node | null {
    if (lo >= hi) {
        return null;
    }
    let mass = 0;
    let weighted = 0;
    for (let i = lo; i < hi; i += 1) {
        const p = particles[i] as Particle;
        mass += p.m;
        weighted += p.m * p.x;
    }
    if (hi - lo === 1) {
        return { lo, hi, mass, com: weighted / mass, left: null, right: null, index: lo };
    }
    const mid = Math.floor((lo + hi) / 2);
    return {
        lo,
        hi,
        mass,
        com: weighted / mass,
        left: buildTree(particles, lo, mid),
        right: buildTree(particles, mid, hi),
        index: -1,
    };
}

/** Force on a target from one accepted node, using Plummer softening. */
function nodeForce(target: Particle, mass: number, com: number, softening: number): number {
    const dx = com - target.x;
    const denom = (dx * dx + softening * softening) ** 1.5;
    return (target.m * mass * dx) / denom;
}

/** Barnes-Hut approximation of the force on one target particle. */
export function barnesHutForce(particles: Particle[], tree: Node | null, targetIndex: number, theta: number, softening: number): number {
    const target = particles[targetIndex] as Particle;
    let force = 0;
    const stack: Node[] = tree ? [tree] : [];
    while (stack.length > 0) {
        const node = stack.pop() as Node;
        if (node.mass === 0 || (node.hi - node.lo === 1 && node.index === targetIndex)) {
            continue;
        }
        const width = (particles[node.hi - 1] as Particle).x - (particles[node.lo] as Particle).x;
        const distance = Math.abs(node.com - target.x);
        const isLeaf = node.left === null && node.right === null;
        if (isLeaf || (distance > 0 && width / distance < theta)) {
            force += nodeForce(target, node.mass, node.com, softening);
        } else {
            if (node.left) {
                stack.push(node.left);
            }
            if (node.right) {
                stack.push(node.right);
            }
        }
    }
    return force;
}

/** Exact O(N^2) reference force for cross-checking. */
export function directForce(particles: Particle[], targetIndex: number, softening: number): number {
    const target = particles[targetIndex] as Particle;
    let force = 0;
    for (let i = 0; i < particles.length; i += 1) {
        if (i === targetIndex) {
            continue;
        }
        const other = particles[i] as Particle;
        force += nodeForce(target, other.m, other.x, softening);
    }
    return force;
}

function makeNodes(particles: Particle[], active: number): VisualEntity[] {
    return particles.map((p, i) => ({
        id: `particle-${i}`,
        type: "node" as const,
        label: `p${i}:${p.x.toFixed(2)}`,
        value: p.x,
        state: i === active ? "comparing" : "idle",
        x: p.x,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, mass: p.m, position: p.x },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { positions?: number[]; masses?: number[]; theta?: number; softening?: number } | null) ?? {};
    const positions = Array.isArray(task.positions) && task.positions.length >= 2
        ? task.positions.map(Number)
        : [0, 1, 2, 3, 4, 5, 6, 7];
    const particles: Particle[] = positions.map((x, i) => ({
        x,
        m: Array.isArray(task.masses) ? Number(task.masses[i] ?? 1) : 1,
    })).sort((a, b) => a.x - b.x);
    const theta = Math.max(0, Number(task.theta ?? 0.5));
    const softening = Math.max(1e-6, Number(task.softening ?? 0.1));
    const tree = buildTree(particles, 0, particles.length);
    const approximate = particles.map((_p, i) => barnesHutForce(particles, tree, i, theta, softening));
    const exact = particles.map((_p, i) => directForce(particles, i, softening));
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(particles, -1),
        edges: [],
        description: `Build a Barnes-Hut tree over ${particles.length} particles with opening angle ${theta}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { theta, softening, forces: [...approximate], exact: [...exact], positions: particles.map((p) => p.x) },
    };
    step += 1;

    for (let i = 0; i < particles.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeNodes(particles, i),
            edges: [],
            description: `Particle ${i}: tree force ${(approximate[i] as number).toFixed(6)} versus direct ${(exact[i] as number).toFixed(6)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                theta,
                softening,
                active: i,
                forces: [...approximate],
                exact: [...exact],
                currentApprox: approximate[i] as number,
                currentExact: exact[i] as number,
                error: Math.abs((approximate[i] as number) - (exact[i] as number)),
            },
        };
        step += 1;
    }

    const maxError = Math.max(...approximate.map((f, i) => Math.abs(f - (exact[i] as number))));
    const momentum = approximate.reduce((sum, f) => sum + f, 0);
    yield {
        stepNumber: step,
        entities: makeNodes(particles, -1),
        edges: [],
        description: `Maximum force error ${maxError.toExponential(3)}; net force ${momentum.toExponential(3)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            theta,
            softening,
            forces: [...approximate],
            exact: [...exact],
            maxError,
            netForce: momentum,
            thetaZeroExact: theta === 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A distant clump of stars pulls on a particle almost as if all its mass sat at the clump center of mass. Barnes and Hut exploit this by storing particles in a tree and replacing any sufficiently small and distant subtree with a single center-of-mass term. The opening angle controls how aggressively groups are accepted, trading accuracy for speed.",
        invariants: [
            "Every tree node stores the total mass and center of mass of its subtree.",
            "A subtree is accepted only when its size over its distance is below theta.",
            "The net internal force sums to zero by Newton's third law.",
        ],
        correctness:
            "The multipole expansion of a cluster's gravitational potential has the cluster mass as its leading term, with corrections of order the cluster size divided by the distance. The opening-angle criterion bounds that correction, so each accepted node contributes an approximation error proportional to (size over distance) squared. At theta zero no cluster can ever be accepted except leaves, so every pair is evaluated directly and the result equals the O(N^2) reference exactly.",
        complexityRationale:
            "Building the balanced tree costs O(N log N) and each force walk visits O(log N) accepted or expanded nodes for a well-separated distribution, giving O(N log N) per full evaluation. The tree stores one record per particle and internal node, so space is O(N).",
        uses: [
            "Astrophysical N-body galaxy and cluster simulations",
            "Fast approximate force fields in molecular dynamics",
            "Hierarchical spatial indexing for potential-field evaluation",
        ],
        references: [
            "Barnes and Hut, A Hierarchical O(N log N) Force-Calculation Algorithm, 1986",
            "Hockney and Eastwood, Computer Simulation Using Particles, 1988",
        ],
        workedExample:
            "For eight unit masses at positions zero through seven with softening 0.1 and theta zero, the tree force on the end particle equals the direct sum to machine precision. The net force over all particles is zero because every pair contributes equal and opposite terms.",
    },
    id: "barnes-hut-simulation",
    name: "Barnes-Hut N-Body Simulation",
    category: "numerical-optimization",
    complexity: { time: "O(N log N)", space: "O(N)" },
    defaultInput: { positions: [0, 1, 2, 3, 4, 5, 6, 7], masses: [1, 1, 1, 1, 1, 1, 1, 1], theta: 0.5, softening: 0.1 },
    visualType: "point",
    run,
    pseudocode: [
        "sort the particles by position",
        "build a binary tree storing mass and center of mass per node",
        "for each target start a traversal at the root",
        "accept a node when its size over distance is below theta",
        "otherwise push both children and continue",
        "add each accepted node's softened force",
        "compare with the direct pairwise reference",
        "done: report forces, maximum error and net force",
    ],
};

export default module;
