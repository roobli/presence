---
title: 苹果的 container：一个容器一台虚拟机
date: 2026-09-30
lang: zh
tags: [virtualization, macos]
link: https://github.com/apple/container
link_title: apple/container
---

在 Mac 上跑 Linux 容器，Docker Desktop 的做法是起一台共享的 Linux 虚拟机，把所有容器都塞进去。苹果开源的 `container` 反过来：每个容器一台轻量 Linux 虚拟机，直接用 Virtualization.framework 起，不另带 VMM 二进制。到 9 月 30 日它在 GitHub 上已有约 5 万 star。

区别一句话就能说清：容器假在视图和配额，microVM 假在硬件和客户机内核。每个工作负载一份内核，隔离边界就不再是「大家共用一个内核」。

代价也跟着来。内核要自己带，仓库里有一份为快速启动裁过的配置，内核从「宿主机碰巧是什么」变成了你要维护的东西。它的定位是开发用的笔记本，不是机房；服务器上要把 OCI 镜像放进 microVM，还是看 Kata 或 libkrun。
