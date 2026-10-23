import { describe, expect, it } from 'vitest'

import { type ChatMessage, collapseSameRowId, textPart } from './index'

const row = (id: string, role: 'user' | 'assistant', text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role,
  parts: [textPart(text)],
  ...extra
})

describe('collapseSameRowId', () => {
  it('drops the duplicate copy a resync folds back onto a live bubble (#138259)', () => {
    const live = row('live-1', 'user', 'joo ota upstreamista', { rowId: 42 })
    const resync = row('hist-1', 'user', 'joo ota upstreamista', { rowId: 42 })
    const between = row('a-1', 'assistant', 'Tässä tilanne:')

    const next = collapseSameRowId([live, between, resync])

    expect(next.map(message => message.id)).toEqual(['live-1', 'a-1'])
    expect(next).not.toBe([live, between, resync])
  })

  it('keeps the completed row when the pending live copy shares its rowId', () => {
    const pending = row('live-1', 'assistant', 'Vastaus', { rowId: 7, pending: true })
    const persisted = row('hist-1', 'assistant', 'Vastaus', { rowId: 7 })

    const next = collapseSameRowId([pending, persisted])

    expect(next.map(message => message.id)).toEqual(['hist-1'])
  })

  it('keeps the richer copy when both are complete', () => {
    const plain = row('hist-1', 'assistant', 'Katsotaan', { rowId: 9 })
    const withTools = row('live-1', 'assistant', 'Katsotaan', {
      rowId: 9,
      parts: [textPart('Katsotaan'), textPart('valmis')]
    })

    const next = collapseSameRowId([plain, withTools])

    expect(next.map(message => message.id)).toEqual(['live-1'])
  })

  it('leaves rowless and distinct-row messages untouched, preserving array identity', () => {
    const messages = [
      row('u-1', 'user', 'sama teksti kahdesti'),
      row('u-2', 'user', 'sama teksti kahdesti'),
      row('live-streaming', 'assistant', 'virrassa', { pending: true })
    ]

    expect(collapseSameRowId(messages)).toBe(messages)
  })
})
