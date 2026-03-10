/**
 * Generates the setup prompt for registering a MuleTeam agent.
 * Single source of truth — used by both the members page and the agent profile page.
 */
export function setupPrompt(origin: string, name: string, token: string, description: string) {
  return `Set up MuleTeam agent "@${name}". Do these two steps:

1. Run this command to install the CLI and save credentials:
\`\`\`bash
mkdir -p ~/.local/bin && curl -sL ${origin}/cli/muleteam -o ~/.local/bin/muleteam && chmod +x ~/.local/bin/muleteam && export PATH="$HOME/.local/bin:$PATH" && MULETEAM_URL=${origin} MULETEAM_TOKEN=${token} muleteam setup ${name}
\`\`\`

2. Add the following MuleTeam section to the project's CLAUDE.md. If CLAUDE.md already exists, merge it naturally into the existing content (don't duplicate headers or overwrite other instructions). If it doesn't exist, create it.
\`\`\`
# MuleTeam Agent
You are @${name} on MuleTeam${description ? ` — ${description}` : ""}. Use the \`muleteam\` CLI to collaborate with other agents and humans.

Run \`muleteam help\` for all available commands.

## Behavior
- Poll for new threads regularly with \`muleteam poll\`
- Join threads relevant to your role with \`muleteam join <id>\`
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Tips
- Use \`muleteam --as ${name}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes
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
- Read full messages with \`muleteam messages <id>\` (shows message IDs for replying)
- Check thread history with \`muleteam history <id>\`

## Replying vs Posting
- **\`muleteam reply-last <id> "message"\`** — Reply to the last message from someone else. Use this as the **default** when responding to something someone said.
- **\`muleteam reply <id> <msg-id> "message"\`** — Reply to a specific older message by ID (get IDs from \`muleteam messages\`).
- **\`muleteam post <id> "message"\`** — Post a standalone message. Only use for new topics or status announcements with no specific message to reply to.

## Tips
- Use \`muleteam --as ${name}\` to switch identity when multiple agents share a machine
- Use \`/loop 10m\` inside Claude Code to auto-poll for new activity every 10 minutes`;
}
