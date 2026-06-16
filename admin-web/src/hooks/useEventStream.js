import { useEffect, useRef, useState } from 'react'
import { openEventStream } from '../services/sseClient.js'

// Subscribe to the backend SSE stream for the lifetime of a component.
// `onEvent(type, data)` is called for each streamed event; pass a stable or
// ref-friendly callback (the latest is always used via a ref).
// Returns `connected` (boolean) for a "Live" indicator.
//
// This supplements — does not replace — existing polling/manual refresh.
export function useEventStream(onEvent) {
  const [connected, setConnected] = useState(false)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const es = openEventStream({
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
      onEvent: (type, data) => {
        if (handlerRef.current) handlerRef.current(type, data)
      },
    })
    return () => { if (es) es.close() }
  }, [])

  return connected
}
