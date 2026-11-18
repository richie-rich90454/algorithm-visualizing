# Show HN: Algorithm Visualization Engine – 1167 algorithms you can watch step by step

I built an open-source algorithms visualizer because most existing tools either show a handful of classic examples or ask you to write the algorithm yourself. This one ships 1167 ready-to-run algorithms across 20 categories, from sorting and graphs to quantum algorithms and production systems, each as a deterministic frame generator you can play, pause, rewind, and step through.

What makes it different:

- Every algorithm has textbook pseudocode with the current line highlighted, plus complexity annotations and a frame-by-frame caption explaining what just happened.
- A new structured education layer adds intuition, invariants, a correctness sketch, complexity rationale, real-world uses, references, and a worked example per algorithm.
- Each algorithm is a small lazy-loaded code chunk, so the initial download stays small even with a catalog this large.
- It is fully self-hosted: local fonts, no CDN, offline-capable.
- A generated static docs site gives every algorithm an indexable page with structured data.

Built with Vue 3, TypeScript, Vite, Pinia, and Canvas 2D. MIT licensed.

Live demo: https://richie-rich90454.github.io/algorithm-visualizing/
Source: https://github.com/richie-rich90454/algorithm-visualizing
Docs: https://richie-rich90454.github.io/algorithm-visualizing/docs/

I would love feedback on which algorithms to add next and where the explanations are still unclear.
