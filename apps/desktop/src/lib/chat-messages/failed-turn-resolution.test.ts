import { describe, expect, it } from 'vitest'

import type { SessionMessage } from '@/types/hermes'

import { toChatMessages } from '.'

// The gateway's context-overflow auto-continue persists a failed_turn boundary
// row (agent/conversation_loop.py::_failed_turn_display_metadata) and hydration
// turns it into the error card. The model then keeps answering on its own (an
// internal_notification turn, or a reset child session), which leaves the card
// stale. Hydration marks such a card `errorResolved` so the renderer can shrink
// it to a compact marker (assistant-message.tsx).
describe('failed-turn card resolution', () => {
  const errorSurface = { code: 'context_overflow', layer: 'provider', retryable: false } as const

  const failedTurnRow = (timestamp: number): SessionMessage => ({
    role: 'assistant',
    content: 'This turn did not complete.',
    timestamp,
    display_kind: 'failed_turn',
    display_metadata: { error: 'context overflow', error_surface: errorSurface }
  })

  const assistantRow = (content: string, timestamp: number): SessionMessage => ({
    role: 'assistant',
    content,
    timestamp
  })

  const userRow = (content: string, timestamp: number): SessionMessage => ({ role: 'user', content, timestamp })

  const cards = (messages: ReturnType<typeof toChatMessages>) => messages.filter(message => message.errorSurface)

  it('marks a failed-turn card resolved once a successful assistant reply follows it', () => {
    const resolved = cards(toChatMessages([userRow('go', 1), failedTurnRow(2), assistantRow('Continuing now.', 3)]))

    expect(resolved).toHaveLength(1)
    expect(resolved[0].errorResolved).toBe(true)
  })

  it('leaves the card unresolved when nothing follows it', () => {
    const resolved = cards(toChatMessages([userRow('go', 1), failedTurnRow(2)]))

    expect(resolved).toHaveLength(1)
    expect(resolved[0].errorResolved).toBeUndefined()
  })

  it('leaves the card unresolved when only a user row follows it', () => {
    const resolved = cards(toChatMessages([failedTurnRow(1), userRow('and now?', 2)]))

    expect(resolved).toHaveLength(1)
    expect(resolved[0].errorResolved).toBeUndefined()
  })

  it('never counts the card itself (it carries an error) as the later success', () => {
    const resolved = cards(toChatMessages([failedTurnRow(1), failedTurnRow(2)]))

    expect(resolved).toHaveLength(2)

    for (const card of resolved) {
      expect(card.errorResolved).toBeUndefined()
    }
  })

  it('marks every earlier card once one success follows them all', () => {
    const resolved = cards(toChatMessages([failedTurnRow(1), failedTurnRow(2), assistantRow('Back on track.', 3)]))

    expect(resolved).toHaveLength(2)

    for (const card of resolved) {
      expect(card.errorResolved).toBe(true)
    }
  })
})
