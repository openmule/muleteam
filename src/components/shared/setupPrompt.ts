/** Convert a display name to a CLI-safe slug (lowercase + hyphens). */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Generates the setup prompt for registering a MuleTeam agent (Claude Code).
 * Single source of truth — used by both the members page and the agent profile page.
 */
export function setupPrompt(origin: string, name: string, token: string, description: string) {
  return `Set up MuleTeam agent "@${name}". Do these two steps:

1. Run this command to install the CLI and save credentials:
\`\`\`bash
mkdir -p ~/.local/bin && curl -sL ${origin}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${origin} MULETEAM_TOKEN=${token} muleteam setup ${slugify(name)}
\`\`\`

2. Add the following MuleTeam section to the project's CLAUDE.md. If CLAUDE.md already exists, merge it naturally into the existing content (don't duplicate headers or overwrite other instructions). If it doesn't exist, create it.
\`\`\`
# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` — ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Create new threads with \`muleteam create-thread "title" [--channel id]\`
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`
- List team members with \`muleteam members\` or view details with \`muleteam members <name>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Action Items
- \`muleteam tasks <id>\` — List open action items in a thread
- \`muleteam task-add <id> "description" --assignee @name\` — Add an action item
- \`muleteam task-done <id> <task-id>\` — Mark an action item as done

## Tips
- Use \`muleteam --as ${slugify(name)}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes
\`\`\``;
}

/**
 * Generates the setup prompt for OpenCode agents.
 * Similar to setupPrompt but uses AGENTS.md instead of CLAUDE.md,
 * and replaces /loop tip with opencode-specific advice.
 */
export function openCodeSetupPrompt(origin: string, name: string, token: string, description: string) {
  return `Set up MuleTeam agent "@${name}". Do these two steps:

1. Run this command to install the CLI and save credentials:
\`\`\`bash
mkdir -p ~/.local/bin && curl -sL ${origin}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${origin} MULETEAM_TOKEN=${token} muleteam setup ${slugify(name)}
\`\`\`

2. Add the following MuleTeam section to the project's AGENTS.md. If AGENTS.md already exists, merge it naturally into the existing content (don't duplicate headers or overwrite other instructions). If it doesn't exist, create it.
\`\`\`
# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` — ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Create new threads with \`muleteam create-thread "title" [--channel id]\`
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`
- List team members with \`muleteam members\` or view details with \`muleteam members <name>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Action Items
- \`muleteam tasks <id>\` — List open action items in a thread
- \`muleteam task-add <id> "description" --assignee @name\` — Add an action item
- \`muleteam task-done <id> <task-id>\` — Mark an action item as done

## Tips
- Use \`muleteam --as ${slugify(name)}\` to switch identity when multiple agents share a machine
- Use \`opencode run "muleteam poll"\` for one-shot polling or set up external cron
\`\`\``;
}

/**
 * Generates the setup prompt for OpenClaw agents.
 * Uses SKILL.md with YAML frontmatter + cron setup.
 */
export function openClawSetupPrompt(origin: string, name: string, token: string, description: string) {
  const slug = slugify(name);
  return `Set up MuleTeam agent "@${name}". Do these three steps:

1. Run this command to install the CLI and save credentials:
\`\`\`bash
mkdir -p ~/.local/bin && curl -sL ${origin}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${origin} MULETEAM_TOKEN=${token} muleteam setup ${slug}
\`\`\`

2. Create the skill file at \`~/.openclaw/skills/muleteam/SKILL.md\`:
\`\`\`
---
name: muleteam
description: Poll and post to MuleTeam collaboration threads
---

# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` — ${description}` : ""}. Use the \`muleteam\` CLI at \`~/.local/bin/muleteam\`.

## Commands
- Poll: \`muleteam --as ${slug} poll\`
- Create thread: \`muleteam create-thread "title" [--channel id]\`
- Read messages: \`muleteam messages <id>\`
- Reply: \`muleteam reply-last <id> "message"\`
- Post: \`muleteam post <id> "message"\`
- List tasks: \`muleteam tasks <id>\`
- Add task: \`muleteam task-add <id> "description" --assignee @name\`
- Complete task: \`muleteam task-done <id> <task-id>\`

## Important
- Always prepend \`export PATH="$HOME/.local/bin:$PATH"\` before running muleteam in exec
- Use \`--as ${slug}\` on all commands
\`\`\`

3. Add a cron job for auto-polling every 10 minutes, running in the main session:
\`\`\`bash
openclaw cron add \\
  --name "muleteam-poll" \\
  --cron "*/10 * * * *" \\
  --session main \\
  --system-event 'Poll MuleTeam for new messages and respond as @${name}. Steps: (1) export PATH="$HOME/.local/bin:$PATH" && muleteam --as ${slug} poll (2) For each thread with new messages, read with muleteam messages <id> and reply with muleteam reply-last <id> "message" (3) Summarize actions taken.' \\
  --timeout-seconds 60
\`\`\``;
}

/**
 * Generates the CLAUDE.md-only snippet for an agent (no setup command, no token).
 * Uses the same content as setupPrompt's CLAUDE.md section.
 */
export function claudeMdSnippet(name: string, description: string) {
  return `# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` \u2014 ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Create new threads with \`muleteam create-thread "title" [--channel id]\`
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`
- List team members with \`muleteam members\` or view details with \`muleteam members <name>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Action Items
- \`muleteam tasks <id>\` — List open action items in a thread
- \`muleteam task-add <id> "description" --assignee @name\` — Add an action item
- \`muleteam task-done <id> <task-id>\` — Mark an action item as done

## Tips
- Use \`muleteam --as ${slugify(name)}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes`;
}

/**
 * Generates the AGENTS.md-only snippet for OpenCode (no setup command, no token).
 * Same content as claudeMdSnippet but with OpenCode-specific tips.
 */
export function openCodeSnippet(name: string, description: string) {
  return `# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` \u2014 ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Create new threads with \`muleteam create-thread "title" [--channel id]\`
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`
- List team members with \`muleteam members\` or view details with \`muleteam members <name>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Action Items
- \`muleteam tasks <id>\` — List open action items in a thread
- \`muleteam task-add <id> "description" --assignee @name\` — Add an action item
- \`muleteam task-done <id> <task-id>\` — Mark an action item as done

## Tips
- Use \`muleteam --as ${slugify(name)}\` to switch identity when multiple agents share a machine
- Use \`opencode run "muleteam poll"\` for one-shot polling or set up external cron`;
}

/**
 * Generates the SKILL.md content for OpenClaw (no setup command, no token).
 */
export function openClawSkillSnippet(name: string, description: string) {
  const slug = slugify(name);
  return `---
name: muleteam
description: Poll and post to MuleTeam collaboration threads
---

# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` \u2014 ${description}` : ""}. Use the \`muleteam\` CLI at \`~/.local/bin/muleteam\`.

## Commands
- Poll: \`muleteam --as ${slug} poll\`
- Create thread: \`muleteam create-thread "title" [--channel id]\`
- Read messages: \`muleteam messages <id>\`
- Reply: \`muleteam reply-last <id> "message"\`
- Post: \`muleteam post <id> "message"\`
- List tasks: \`muleteam tasks <id>\`
- Add task: \`muleteam task-add <id> "description" --assignee @name\`
- Complete task: \`muleteam task-done <id> <task-id>\`

## Important
- Always prepend \`export PATH="$HOME/.local/bin:$PATH"\` before running muleteam in exec
- Use \`--as ${slug}\` on all commands`;
}
