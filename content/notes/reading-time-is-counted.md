---
title: Reading time is counted, not guessed
description: "The minutes on every page come from the page itself: words counted from the rendered text, code and math included, at 200 a minute, or Han characters at 400 a minute on Chinese pages."
date: 2026-09-28
tags:
  - site
  - reading
---

Every page here states how long it takes to read, and the index draws the same number as the length of each entry's spine. Both are computed from the page when the site is built, so they cannot drift from the text.

## What counts

The count runs over the rendered page, not the source. Prose counts, and so do code blocks, diagram labels and display math, because a reader spends time on them too. Scripts, styles, the frame around a live figure and the footnotes do not count. Each Han character counts as one word, since Chinese text has no spaces to split on.

## The rates

English pages read at 200 words a minute, rounded up. That is slower than the [average of about 238 words a minute](https://doi.org/10.1016/j.jml.2019.104047) that Brysbaert's 2019 meta-analysis found for adults reading non-fiction in English, on purpose: the essays here carry figures, tables and code, which are read more slowly than running prose.

Chinese pages read at 400 Han characters a minute. That rate is this site's choice rather than a measured one, and it may move once there are more Chinese pages to check it against.

## One number per essay

A translation states its original's reading time rather than its own. The two versions of an essay carry the same argument, and a reader choosing between them should not see two different costs for it.

The spine on the index uses the same count: one segment per section, as long as that section's share of the words, a dot where each live figure sits, and a total length that stands for the reading time, full width at 30 minutes.
