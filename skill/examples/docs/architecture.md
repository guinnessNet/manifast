# Architecture Overview

This document is an **external document** in a regular `docs/` folder outside
`.manifast/`. Manifast recognizes and shows it automatically even without
frontmatter (the title is inferred from the first H1, the date from the file
system).

Clicking the **Adopt** button in the top right assigns a tracking `uid` to the
frontmatter, so this file keeps being tracked as the same document even if you
move it to another folder.

## Components

- Local server (Fastify)
- Wireframe canvas
- Document dashboard
