---
title: Instrument shell fixture
description: Test page for the essay figure shell. Copy to content/writing/instrument-fixture.md and build with ESSAY_FIG_FIXTURES=1.
date: 2026-09-12
essayFrame: true
---

This page exercises the figure shell. The fixture handle returns with a spring response of 0.35 s.

<!-- interactive:fixture title="Handle on a track" caption="how far past either end the handle travels before it resists, and how it comes back when you let go." alt="A handle resting at the centre of a horizontal track, with a ruler above it." model="Spring response 0.35 s, damping ratio 1, rubber band constant 0.55." -->

The shell reserves the stage height from the registry, so nothing below this paragraph moves when the widget mounts. The rail height is reserved from the row count in the same file.

A second paragraph keeps the next figure below the fold on a phone, which is where the loops of off-screen figures must hold still.

A third paragraph, for the same reason. Scrolling past it brings two of the apple essay's figures into view, with that essay's marker text.

<!-- interactive:zeta-triptych title="Same pull, three damping ratios" caption="where both cost rows reach zero. Below ζ = 1 the spring pays in overshoot; above it, it pays in time." alt="Three responses to the same pull on a 1.2 s axis: ζ 0.5 dips below rest and swings back, ζ 1 arrives without crossing rest, ζ 1.5 approaches slowly. Below them, two cost curves over ζ from 0.3 to 2: overshoot falls to zero at ζ = 1, and extra settle time rises from zero at ζ = 1. A tick marks 0.825, the SwiftUI default." model="Computed from the essay's spring equation with m = 1 and an illustrative stiffness k = 320. ζ 0.5 and 1.5 are illustrative picks for the table's rows. Settled means staying within 1% of the pull; overshoot and extra settle time do not depend on k. Settle times below ζ = 1 are not drawn, because whether they beat ζ = 1 depends on ζ and on the tolerance." -->

<!-- interactive:curvature-comb title="One corner, two constructions" caption="the comb where the straight edge meets the arc. Its teeth jump to full length in one step at every radius, even where the two outlines lie on top of each other." alt="One corner drawn two ways and overlaid: the essay's three-segment continuous corner as a solid line, and a circular arc whose apex touches it, dashed. The outlines differ by at most 0.02 r, yet the comb teeth on the arc start at full length at both joins, while the continuous corner's comb envelope rises from zero to a peak on the diagonal. A strip below plots curvature: a flat plateau between two vertical steps for the arc, and a hill peaking at 2.53/r, with two small steps, for the continuous corner." model="Curvature is how sharply the outline turns at each point; comb teeth grow with it, on one scale for both curves. r is where the continuous corner leaves each straight edge, not a cornerRadius value. The continuous corner is the essay's control-point table, a public reconstruction that is G2-ish, not Apple's internal path, shown as a top-left corner. The arc radius runs from 0.35 r to 1.8 r and starts at 0.54 r, where the apexes touch. The 2.53/r peak and every readout value are computed from that table." -->

A marker quoted in code stays text:

```md
<!-- interactive:fixture caption="not a figure" alt="not a figure" -->
```

See also [the CUDA essay](cuda-course-without-a-gpu).

<!-- interactive:fixture title="Second handle" caption="that numbering continues in document order." alt="The same handle, resting at the centre of its track." -->

Inline math outside a figure still renders: $k = 320$.

<!-- interactive:fixture-img title="Three settles, keys $mod and c$" caption="where each trace first crosses the rest line. Marker text stays literal: $mod, c$, $x$, [32][33], (tid & 31), in[i * stride] and 「32」." alt="Three step responses from one start: ζ 0.5 overshoots by 16.3%, ζ 1 settles without overshoot, ζ 1.5 creeps in." model="k = 320, m = 1, ζ = 0.5, 1 and 1.5; $$x(t)$$ is exact." -->

The end.
