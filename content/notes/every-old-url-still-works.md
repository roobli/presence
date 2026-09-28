---
title: Every old URL still works
description: "Essays moved from /writing/ to /essays/ and projects from /works/ to /projects/. Every earlier address still leads to its page in one hop, and the feed keeps the moved pages' old item IDs, so readers are not shown them again."
date: 2026-09-28
tags:
  - site
  - urls
---

The site now has four sections, and their folders are named after them: essays moved from `/writing/` to `/essays/`, and projects from `/works/` to `/projects/`. A URL that has been posted somewhere is a promise, so every one of the old addresses still works.

## One field, not a list of redirects

Nothing lists the old addresses one by one. The section registry gives each section its earlier names, `formerly: ["writing"]`, and the build derives a redirect for every page from it: `/writing/foo` for `/essays/foo`, and for a Chinese version `/writing/foo/zh` along with the older forms that were already redirecting. A page added later gets its redirect the same way, and renaming a section again is one more entry in that field.

Every redirect points straight at the page as it is now. The essay that was first published as `between-comparison-and-love` has two old addresses, and both land on `/essays/an-unchecked-todo` in one step, with no chain through an intermediate URL.

On a static host a redirect is a small HTML page with a canonical link and an immediate refresh. Google [treats an instant meta refresh as a permanent redirect](https://developers.google.com/search/docs/crawling-indexing/301-redirects), so the old addresses hand their standing to the new ones.

## What a redirect cannot fix

A feed reader does not follow links to tell items apart; it compares their IDs. The RSS feed used each page's URL as its ID, so moving the pages would have made every reader list the old essays again as if they were new.

So the pages published before the move keep their old URL as their feed ID, and only pages published after it use their new one. The addresses changed; the items did not.
