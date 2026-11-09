import { describe, expect, it } from 'vitest'

import { type ChatMessage, collapseCompactedUserGhosts, textPart } from './index'

const row = (id: string, role: 'user' | 'assistant', text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  parts: [textPart(text)],
  ...extra
})

const SUMMARY = '[CONTEXT COMPACTION — REFERENCE ONLY] Earlier turns were compacted into the summary below.'

describe('collapseCompactedUserGhosts', () => {
  it('retires the rowId-less pre-compaction ghost its re-anchored twin replaced (#121212)', () => {
    const summary = row('hist-sum', 'user', SUMMARY)
    const stored = row('hist-1', 'user', 'Täs oli jotain ongelmia taas', { rowId: 220923 })
    const reply = row('hist-2', 'assistant', 'B44 valmis — pahoittelen säätöä')
    const ghost = row('user-5823c379', 'user', 'Täs oli jotain ongelmia taas')

    const next = collapseCompactedUserGhosts([summary, stored, reply, ghost])

    expect(next.map(message => message.id)).toEqual(['hist-sum', 'hist-1', 'hist-2'])
  })

  it('leaves a genuinely new send above the newest boundary untouched', () => {
    const summary = row('hist-sum', 'user', SUMMARY)
    const stored = row('hist-1', 'user', 'Vanha viesti', { rowId: 10 })
    const fresh = row('user-fresh', 'user', 'Uusi kysymys')

    const next = collapseCompactedUserGhosts([summary, stored, fresh])

    expect(next).toHaveLength(3)
  })

  it('does not fire before any compaction boundary', () => {
    const stored = row('hist-1', 'user', 'Sama teksti', { rowId: 10 })
    const reply = row('hist-2', 'assistant', 'Vastaus')
    const ghost = row('user-x', 'user', 'Sama teksti')

    const next = collapseCompactedUserGhosts([stored, reply, ghost])

    expect(next).toHaveLength(3)
  })

  it('ignores the deliberate repeat an earlier turn left behind', () => {
    const older = row('hist-0', 'user', 'Katsotaan', { rowId: 5 })
    const summary = row('hist-sum', 'user', SUMMARY)
    const reply = row('hist-2', 'assistant', 'Vastaus')
    const fresh = row('user-fresh', 'user', 'Katsotaan')

    // The twin sits ABOVE the boundary: a repeat typed after compaction is a
    // deliberate send, and the windowed collapse must keep it.
    const next = collapseCompactedUserGhosts([older, summary, reply, fresh])

    expect(next).toHaveLength(4)
  })

  it('never retires a bound row', () => {
    const summary = row('hist-sum', 'user', SUMMARY)
    const stored = row('hist-1', 'user', 'Teksti', { rowId: 10 })
    const other = row('hist-2', 'user', 'Teksti', { rowId: 11 })

    const next = collapseCompactedUserGhosts([summary, stored, other])

    expect(next).toHaveLength(3)
  })

  it('keeps attachment-distinct sends apart', () => {
    const summary = row('hist-sum', 'user', SUMMARY)
    const stored = row('hist-1', 'user', 'Kuva', { rowId: 10, attachmentRefs: ['image:a.png'] })
    const fresh = row('user-fresh', 'user', 'Kuva')

    const next = collapseCompactedUserGhosts([summary, stored, fresh])

    expect(next).toHaveLength(3)
  })
})
