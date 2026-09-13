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

A third paragraph, for the same reason. Scrolling past it brings the pre-shell widgets into view.

<!-- interactive:spring-zeta title="Spring, mass, damper" caption="how the damping ratio changes the settle." alt="A mass at rest on a track above an empty position plot." model="Parameters chosen for illustration: m = 1, k = 320, ζ = 0.70." -->

<!-- interactive:zeta-triptych title="Three damping ratios" caption="where each trace first touches the rest line." alt="Three step responses: one overshoots, one settles cleanly, one crawls." model="m = 1, k = 320, ζ = 0.5, 1.0 and 1.5." -->

<!-- interactive:squircle-compare title="Two corners" caption="the join where the straight edge meets the curve." alt="A circular rounded square beside a continuous-corner square." model="Default radius r = 36." -->

<!-- interactive:curvature-comb title="Curvature comb" caption="whether the comb steps or ramps at the corner." alt="One plate corner with zebra stripes and a curvature comb." -->

A marker quoted in code stays text:

```md
<!-- interactive:fixture caption="not a figure" alt="not a figure" -->
```

See also [the CUDA essay](cuda-course-without-a-gpu).

<!-- interactive:fixture title="Second handle" caption="that numbering continues in document order." alt="The same handle, resting at the centre of its track." -->

The end.
