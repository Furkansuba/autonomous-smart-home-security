// Small "Live" / "Offline" pill showing the SSE connection state.
function LiveIndicator({ connected }) {
  return (
    <span className={`live-indicator${connected ? ' live-indicator--on' : ' live-indicator--off'}`}>
      <span className="live-indicator-dot" />
      {connected ? 'Live' : 'Offline'}
    </span>
  )
}

export default LiveIndicator
