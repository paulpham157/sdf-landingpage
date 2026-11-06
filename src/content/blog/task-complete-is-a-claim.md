---
title: Task complete is still a claim
date: 2026-10-20
summary: A sample note on why an agent's own grade is not evidence. Not a customer story and not a result.
tags:
  - verification
  - decision-graph
sample: true
draft: false
---

An agent can report the task complete and still be wrong. The report is a claim. SDF checks that claim against acceptance criteria you declared first, and keeps Cost per Accepted Outcome on the same record.

This is for platform, security, and engineering leaders who already run two or more coding agents. Copilot, Cursor, Devin, and Factory can each grade their own work. None of those grades is something security or finance can re-run. Seat price and token price do not answer the question that matters: did the attempt meet the criteria?

SDF does not sell an agent, and it does not resell model tokens. You bring the subscriptions and keys you already have. The task is routed to one of those agents. SDF then runs checks the agent cannot forge, and a PASS is tied to the exact code revision.

What you keep is an append-only Decision Graph. It links the objective, the attempt, the evidence, the verdict, and the cost. That record is what you can audit. The number it is meant to produce is Cost per Accepted Outcome, not cost per seat and not cost per token. SDF's own dollar amounts are not published. They stay unpublished until design partners validate them.

This note is a sample of the blog. SDF runs live only on a toy fixture, and nothing here is a measured result. Teams already running two or more agents can [baseline Cost per Accepted Outcome](/design-partners) before and after SDF. A picture of the record, also a sample, is the [Evidence Report](/sample-evidence-report).
