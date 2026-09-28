---
title: The sidebar now knows what it lists
description: "The tree beside every page used to be built in the browser from an index of titles and links. It is now rendered with the page, from the same data as the index, so it can show a series' progress, a note's date and a project's status."
date: 2026-09-28
tags:
  - site
  - quartz
---

The file tree in the sidebar is the part of this site that most resembles the notebook it comes from, and until now it was also the part that knew the least.

## What it could not know

Quartz builds its explorer in the browser. After each page loads, a script fetches the content index and turns it into a tree. That index carries each page's title, links, tags and text, which is enough to search the site but not enough to describe it: there are no dates, no episode numbers, no status. The tree could list file names in a sorted order and nothing more, and it arrived a moment after the rest of the page.

## Rendered with the page

The tree is now built when the site is built, from the same model the homepage and the section pages use. That is what lets each section say what its entries are:

- Essays by title, newest first.
- A series as a folder with its progress, [[series/kernels-from-zero/index|3 of 5]] for the first one, its published episodes numbered and the planned ones in grey.
- A project with a dot for its status.
- A note with its date.

The page you are on is marked on the server, a Chinese version marking its English original, and the folders above it are open before anything is drawn.

## What stayed the same

The tree keeps the markup the explorer produced, so everything built on top of it kept working unchanged: the guide lines, the folders that stay pinned at the top of the panel while you scroll, and the buttons that reveal the open page and fold everything away. Which folders a reader has closed is still kept in the same place in the browser, and applied by a few lines that run right after the tree, before the first paint.

## What it costs

Every page now carries the whole tree in its HTML. On this site that is about 9 KB per page before compression and a little over 2 KB after, and it grows by a line with each entry. In return the tree no longer waits for the content index, which search still fetches, so it is on screen with the rest of the page.
