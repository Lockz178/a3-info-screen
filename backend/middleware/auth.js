const crypto = require("crypto");
const { loadConfig } = require("../utils/fileHelpers");

const REMEMBER_COOKIE = "dashRemember";

/*
  rememberToken — derives a stable token from the current dashboard password
  for the "remember me" cookie. Because it is derived from the password,
  changing the password changes the token, so every remembered login is
  automatically invalidated when the password changes — exactly the desired
  "remember until the password is changed" behaviour.
*/
function rememberToken(password) {
  return crypto.createHash("sha256").update("a3-dash:" + password).digest("hex");
}

// Minimal cookie reader so we don't need an extra dependency.
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const found = header.split(";").map(c => c.trim()).find(c => c.startsWith(name + "="));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

/*
  isAuthed — true when the request may access the dashboard: no password is set
  (protection off), the session is authenticated, or a valid "remember me"
  cookie matching the current password is present.
*/
function isAuthed(req) {
  const config = loadConfig();
  if (!config.dashboardPassword) return true;
  if (req.session && req.session.authenticated) return true;
  const token = getCookie(req, REMEMBER_COOKIE);
  return !!token && token === rememberToken(config.dashboardPassword);
}

/*
  requireAuth — API middleware. Returns 401 JSON for unauthenticated requests.
  Used on write endpoints (upload, delete, reorder) so the dashboard cannot be
  bypassed via curl or direct API calls.
*/
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: "Authentication required." });
}

/*
  requireAuthPage — page middleware. Redirects to /login.html instead of
  returning JSON, because the browser needs a page to render, not a 401.
*/
function requireAuthPage(req, res, next) {
  if (isAuthed(req)) return next();
  return res.redirect("/login.html");
}

module.exports = { requireAuth, requireAuthPage, isAuthed, rememberToken, REMEMBER_COOKIE };
