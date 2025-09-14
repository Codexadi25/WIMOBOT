const express = require('express');
const router = express.Router();

const ROTATE_INTERVAL = 30 * 60 * 1000; // 30 minutes

// GET /api/ping
// Touches session to extend cookie and rotates session id periodically for security.
router.get('/ping', (req, res) => {
  if (!req.session) return res.status(200).json({ ok: true });

  try {
    // extend expiry
    if (typeof req.session.touch === 'function') req.session.touch();
    const now = Date.now();
    const lastRotated = req.session._lastSessionRotate || 0;

    if (now - lastRotated > ROTATE_INTERVAL) {
      // preserve session data except cookie meta
      const data = { ...req.session };
      delete data.cookie;

      req.session.regenerate(err => {
        if (err) {
          console.error('Session rotate error:', err);
          // still respond OK so client pings continue
          req.session._lastSessionRotate = now;
          return res.json({ ok: true });
        }
        // restore preserved data
        Object.assign(req.session, data);
        req.session._lastSessionRotate = now;
        req.session.save(saveErr => {
          if (saveErr) console.error('Session save after rotate error:', saveErr);
          return res.json({ ok: true, rotated: true });
        });
      });
      return;
    } else {
      req.session._lastPingAt = now;
    }
  } catch (err) {
    console.error('Ping handler error:', err);
  }

  return res.json({ ok: true });
});

module.exports = router;