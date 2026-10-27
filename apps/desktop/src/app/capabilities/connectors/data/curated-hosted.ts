/**
 * Fork curation (Chroma01/hermes-agent): the portal's hosted-connector catalog is a marketing
 * directory of ~60 SaaS integrations (Adobe, Ahrefs, Semrush, ...). This harness shows only the
 * curated slugs, plus anything already connected or holding an account. Everything else stays
 * reachable through manual MCP config. Kept entries are free/local-first and match this
 * installation's actual usage.
 *
 * Hugging Face is intentionally NOT listed here — it is curated on the bundled side
 * (`optional-mcps/hugging_face`) so the repo stays the single source of truth for it.
 */
export const CURATED_HOSTED_SLUGS: ReadonlySet<string> = new Set([
  // Regular research target of this setup (reddit-reading workflow).
  'reddit_mcp',
  // AI / Kurzweil discourse lives on X.
  'twitter_mcp'
])
