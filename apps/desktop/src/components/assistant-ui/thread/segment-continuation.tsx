import { useStore } from '@nanostores/react'
import { type FC, type ReactNode, useMemo } from 'react'
import { useInRouterContext, useNavigate } from 'react-router'

import { useSessionView } from '@/app/chat/session-view'
import { openSession, openSessionFromPicker } from '@/app/open-session'
import { useI18n } from '@/i18n'
import { ArrowUpRight, Clock } from '@/lib/icons'
import { $sessions, sessionMatchesStoredId } from '@/store/session'
import type { SessionInfo } from '@/types/hermes'

/**
 * Transcript-edge cards for the auto-reset segment boundary. When the model's
 * context fills, the gateway seals the session and a NEW child session carries
 * the conversation on (`_reset_from` points at the sealed parent). The seam is
 * otherwise invisible: the child's view starts at its own first row, and the
 * parent's view ends without saying where the chat went. These cards name the
 * other segment (its title when the row is loaded) and open it on click.
 */

interface SegmentLink {
  id: string
  title: null | string
}

/** The older segment this transcript continues, and the newer one it continues
 *  into — resolved from the loaded session list, memoized on its reference
 *  (the list is replaced wholesale, never mutated). */
function useSegmentLinks(): { from: null | SegmentLink; into: null | SegmentLink } {
  const view = useSessionView()
  const storedId = useStore(view.$storedId)
  const sessions = useStore($sessions)

  return useMemo(() => {
    if (!storedId) {
      return { from: null, into: null }
    }

    const opened = sessions.find(session => sessionMatchesStoredId(session, storedId))
    const parentId = opened?._reset_from?.trim() ?? ''
    const parent = parentId ? sessions.find(session => sessionMatchesStoredId(session, parentId)) : undefined

    // Several children can reset off one sealed parent; the newest is the live
    // continuation, so it owns the card.
    let newestChild: SessionInfo | undefined

    for (const session of sessions) {
      if (session._reset_from?.trim() === storedId && (!newestChild || session.last_active > newestChild.last_active)) {
        newestChild = session
      }
    }

    return {
      from: parentId ? { id: parentId, title: parent?.title ?? null } : null,
      into: newestChild ? { id: newestChild.id, title: newestChild.title ?? null } : null
    }
  }, [sessions, storedId])
}

// Muted pill matching the list's "Show earlier messages" affordance; a real
// button so keyboard users reach it.
const SegmentCardButton: FC<{
  className: string
  dataSlot: string
  icon: ReactNode
  label: string
  onOpen: () => void
}> = ({ className, dataSlot, icon, label, onOpen }) => (
  <button
    className={`mx-auto flex items-center gap-1.5 rounded-full border border-border/65 bg-(--composer-fill) px-3 py-1 text-xs text-muted-foreground hover:text-foreground ${className}`}
    data-slot={dataSlot}
    onClick={onOpen}
    type="button"
  >
    {icon}
    <span className="max-w-72 truncate">{label}</span>
  </button>
)

// Isolated because useNavigate() THROWS outside a <Router> (bare test
// harnesses, embedded panes render threads router-free) — the same gate as
// assistant-message.tsx's SettingsLinkAction. Inside a router the click goes
// through `openSessionFromPicker`, the door that mirrors the sidebar row's
// plain click (explicit resume + jump to the tile/main holding the chat).
const SegmentCardInRouter: FC<{
  className: string
  dataSlot: string
  icon: ReactNode
  label: string
  sessionId: string
}> = ({ className, dataSlot, icon, label, sessionId }) => {
  const navigate = useNavigate()

  return (
    <SegmentCardButton
      className={className}
      dataSlot={dataSlot}
      icon={icon}
      label={label}
      onOpen={() =>
        // 'main': route the target segment into this window unconditionally.
        // The default in-place door resolves through lineage aliases, and a
        // reset child aliases its sealed parent (and vice versa) — the door
        // would call the sibling "already on screen", front the current chat
        // (a visual no-op) and never navigate. The bridge card promises the
        // OTHER segment, so jump to it; resumeSession drops the redundant
        // tile when the main surface binds the same id.
        openSessionFromPicker(sessionId, navigate, 'main')
      }
    />
  )
}

const SegmentCard: FC<{ className: string; dataSlot: string; icon: ReactNode; label: string; sessionId: string }> = ({
  className,
  dataSlot,
  icon,
  label,
  sessionId
}) =>
  useInRouterContext() ? (
    <SegmentCardInRouter className={className} dataSlot={dataSlot} icon={icon} label={label} sessionId={sessionId} />
  ) : (
    // Router-free fallback: the sidebar row's ⌘-click door. The `tab` intent
    // ignores navigate, so it works without one.
    <SegmentCardButton
      className={className}
      dataSlot={dataSlot}
      icon={icon}
      label={label}
      onOpen={() => openSession(sessionId, () => undefined, 'tab')}
    />
  )

/** Above the first message: this transcript continues a sealed older segment. */
export const SegmentContinuesFromCard: FC = () => {
  const { t } = useI18n()
  const { from } = useSegmentLinks()

  if (!from) {
    return null
  }

  return (
    <SegmentCard
      className="mb-(--conversation-turn-gap)"
      dataSlot="aui_thread-segment-from"
      icon={<Clock aria-hidden className="size-3.5 shrink-0" />}
      label={t.assistant.thread.segmentContinuesFrom(from.title)}
      sessionId={from.id}
    />
  )
}

/** Below the last message: the conversation moved on into a newer segment. */
export const SegmentContinuesInCard: FC = () => {
  const { t } = useI18n()
  const { into } = useSegmentLinks()

  if (!into) {
    return null
  }

  return (
    <SegmentCard
      className="mt-(--conversation-turn-gap)"
      dataSlot="aui_thread-segment-into"
      icon={<ArrowUpRight aria-hidden className="size-3.5 shrink-0" />}
      label={t.assistant.thread.segmentContinuesIn(into.title)}
      sessionId={into.id}
    />
  )
}
