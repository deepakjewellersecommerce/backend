const dotenv = require("dotenv");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
dotenv.config();
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SERVER_URL } = process.env;

// Register Google OAuth strategy only if all required env vars are present.
// The passport-google-oauth20 Strategy constructor throws when "clientID" is missing,
// which causes the application to crash during startup. We skip registration and
// log a clear warning when the env vars are not set in production.
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && SERVER_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/auth/google/callback`,
      },
      function (accessToken, refreshToken, profile, done) {
        return done(null, profile);
      }
    )
  );
} else {
  console.warn(
    "Google OAuth disabled: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/SERVER_URL environment variables. Skipping passport strategy registration."
  );
}

module.exports = passport;

/* passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(function (user, done) {
  return done(null, user.id);
}); */
