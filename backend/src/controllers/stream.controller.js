const { subscribeStream } = require('../services/eventBus.service');

// Server-Sent Events stream. Holds the HTTP connection open and pushes safe activity
// summaries to the client as they happen. Authentication is handled by the route
// middleware before this runs.
function streamEvents(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tell nginx not to buffer this response, so events flush immediately.
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  // Client reconnect backoff hint + initial comment so the connection "opens".
  res.write('retry: 5000\n\n');
  res.write(': connected\n\n');

  const unsubscribe = subscribeStream((message) => {
    if (!message) return;
    try {
      res.write(`event: ${message.type || 'message'}\n`);
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    } catch (e) {
      // Write after close — ignore; the close handler will clean up.
    }
  });

  // Keep-alive ping (comment line) so proxies/clients don't drop an idle connection.
  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      /* ignore */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
    res.end();
  });
}

module.exports = { streamEvents };
