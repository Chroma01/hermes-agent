import { describe, expect, it } from 'vitest'

import { type ChatMessage, collapseSameRowId, collapseSupersededStreamRows, textPart } from './index'

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

describe('collapseSupersededStreamRows', () => {
  it('retires a finished live stream bubble once its row has committed', () => {
    const committed = row('1792777963.8-110-assistant', 'assistant', 'Rakennus menee putkessa')
    const finishedStream = row('assistant-stream-1792777961940-1', 'assistant', 'Rakennus menee putkessa')

    const next = collapseSupersededStreamRows([committed, finishedStream])

    expect(next.map(message => message.id)).toEqual(['1792777963.8-110-assistant'])
  })

  it('keeps a still-streaming bubble even when an older row shares its prefix text', () => {
    const committed = row('1-1-assistant', 'assistant', 'Valmis vastaus')
    const streaming = row('assistant-stream-99-2', 'assistant', 'Vasta', { pending: true })

    const next = collapseSupersededStreamRows([committed, streaming])

    expect(next.map(message => message.id)).toEqual(['1-1-assistant', 'assistant-stream-99-2'])
  })

  it('keeps a finished stream bubble whose text differs from every committed row', () => {
    const committed = row('1-1-assistant', 'assistant', 'Toinen vastaus')
    const liveBubble = row('assistant-stream-99-1', 'assistant', 'Tuore vastaus')

    expect(collapseSupersededStreamRows([committed, liveBubble])).toHaveLength(2)
  })

  it('normalizes whitespace between live and committed copies', () => {
    const committed = row('1-1-assistant', 'assistant', 'Rivi 1\n\nrivi 2')
    const liveBubble = row('assistant-stream-99-1', 'assistant', 'Rivi 1\nrivi 2')

    const next = collapseSupersededStreamRows([committed, liveBubble])

    expect(next.map(message => message.id)).toEqual(['1-1-assistant'])
  })
})
