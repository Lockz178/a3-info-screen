const { loadConfig } = require("../utils/fileHelpers");

/*
  requireAuth — API middleware. Returns 401 JSON if the session is not
  authenticated. Used on write endpoints (upload, delete, reorder) so the
  dashboard cannot be bypassed via curl or direct API calls.
  If dashboardPassword is empty in config.json, auth is disabled entirely.
*/
function requireAuth(req, res, next) {
  const config = loadConfig();
  if (!config.dashboardPassword) return next();
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: "Authentication required." });
}

/*
  requireAuthPage — page middleware. Redirects to /login.html instead of
  returning JSON, because the browser needs a page to render, not a 401.
*/
function requireAuthPage(req, res, next) {
  const config = loadConfig();
  if (!config.dashboardPassword) return next();
  if (req.session && req.session.authenticated) return next();
  return res.redirect("/login.html");
}

module.exports = { requireAuth, requireAuthPage };
