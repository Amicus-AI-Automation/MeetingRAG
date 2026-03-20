const jwt = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const axios = require("axios");
require("dotenv").config();

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

// ── JWKS cache (refreshed every hour) ──────────────────────
let jwksCache = null;
let jwksCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < CACHE_TTL_MS) {
    return jwksCache;
  }
  const res = await axios.get(JWKS_URI, { timeout: 5000 });
  jwksCache = res.data.keys;
  jwksCacheTime = now;
  return jwksCache;
}

// ── Middleware ─────────────────────────────────────────────
const entraAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized – no token provided" });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Decode header to get key-id (kid)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header) {
      return res.status(401).json({ message: "Invalid token format" });
    }
    const { kid, alg } = decoded.header;

    if (alg !== "RS256") {
      return res.status(401).json({ message: "Unsupported token algorithm" });
    }

    // Fetch JWKS and find matching public key
    let keys;
    try {
      keys = await getJwks();
    } catch (err) {
      console.error("Failed to fetch JWKS:", err.message);
      return res.status(503).json({ message: "Auth service temporarily unavailable" });
    }

    const jwk = keys.find((k) => k.kid === kid);
    if (!jwk) {
      // kid mismatch — force JWKS refresh and retry once
      jwksCache = null;
      try {
        const freshKeys = await getJwks();
        const freshJwk = freshKeys.find((k) => k.kid === kid);
        if (!freshJwk) {
          return res.status(401).json({ message: "Token signing key not found" });
        }
        return verifyAndAttach(token, freshJwk, req, res, next);
      } catch (err) {
        return res.status(401).json({ message: "Token signing key not found" });
      }
    }

    return verifyAndAttach(token, jwk, req, res, next);
  } catch (err) {
    console.error("entraAuth error:", err.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

function verifyAndAttach(token, jwk, req, res, next) {
  let pem;
  try {
    pem = jwkToPem(jwk);
  } catch (err) {
    console.error("JWK→PEM conversion failed:", err.message);
    return res.status(401).json({ message: "Invalid signing key" });
  }

  const validIssuers = [
    `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    `https://sts.windows.net/${TENANT_ID}/`,
  ];

  let verified;
  for (const issuer of validIssuers) {
    try {
      verified = jwt.verify(token, pem, {
        algorithms: ["RS256"],
        audience: CLIENT_ID,
        issuer,
      });
      break;
    } catch (err) {
      // Try next issuer
    }
  }

  if (!verified) {
    // Last attempt without strict issuer (covers multi-tenant or common endpoint)
    try {
      verified = jwt.verify(token, pem, {
        algorithms: ["RS256"],
        audience: CLIENT_ID,
      });
    } catch (err) {
      console.error("Token verification failed:", err.message);
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired – please sign in again" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }
  }

  // Attach user info (matches what meetingController reads as req.user.email)
  req.user = {
    email: verified.preferred_username || verified.upn || verified.email || verified.unique_name || "",
    name: verified.name || "",
    oid: verified.oid || "",
  };

  console.log(`✅ Entra auth verified for user: ${req.user.email}`);

  // ── Persist / update user in MongoDB (fire-and-forget, non-blocking) ──
  try {
    const User = require("../models/User");
    const role = req.headers["x-user-role"] === "admin" ? "admin" : "user";
    User.findOneAndUpdate(
      { email: req.user.email },
      {
        email: req.user.email,
        name: req.user.name,
        role,
        oid: req.user.oid,
        last_login: new Date(),
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    ).catch((err) => console.warn("⚠️ MongoDB user upsert failed:", err.message));
  } catch (e) {
    // mongoose may not be connected — silently skip
  }

  next();
}

module.exports = entraAuth;
