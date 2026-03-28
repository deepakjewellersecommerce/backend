/**
 * PAN Verification Service
 *
 * Currently uses a MOCK implementation that mirrors the real Surepass API
 * contract exactly. When you're ready for production, set the env vars:
 *
 *   PAN_PROVIDER=surepass
 *   SUREPASS_TOKEN=<your_bearer_token>
 *
 * and the service will switch to live calls automatically.
 *
 * Surepass endpoint: POST https://kyc-api.surepass.io/api/v1/pan/pan
 * Docs: https://docs.surepass.io/pan-verification
 */

const axios = require("axios");

// ── PAN format validator ──────────────────────────────────────────────────────
// Format: 5 letters · 4 digits · 1 letter  (e.g. ABCDE1234F)
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// ── Mock database: pre-seeded PANs that will return "verified" ───────────────
// In dev you can add any PAN here to simulate a verified result.
// PANs NOT in this list will return name_match: false (simulates API rejection).
const MOCK_VERIFIED_PANS = {
  ABCDE1234F: { name: "TEST USER ONE",   status: "VALID" },
  XYZAB9876G: { name: "TEST USER TWO",   status: "VALID" },
  PANIN0000A: { name: "DEMO CUSTOMER",   status: "VALID" },
  // Add your own test PANs here during development
};

// ── Surepass response shape (normalised internally) ──────────────────────────
// {
//   success: boolean,
//   data: {
//     pan_number:    string,
//     full_name:     string,       // name on PAN as per IT dept
//     status:        "VALID" | "INVALID" | "FAKE",
//     name_match:    boolean,      // true if submitted name fuzzy-matches IT record
//   },
//   message: string,
//   status_code: number,
// }

class PanService {
  /**
   * Verify a PAN number against the submitted name.
   *
   * @param {string} panNumber  - PAN in uppercase, no spaces
   * @param {string} nameAsOnPan - Name exactly as typed by user
   * @returns {Promise<{ verified: boolean, name: string, message: string, raw: object }>}
   */
  static async verify(panNumber, nameAsOnPan) {
    const pan = (panNumber || "").trim().toUpperCase();

    if (!PAN_REGEX.test(pan)) {
      return {
        verified: false,
        name: "",
        message: "Invalid PAN format. Must be 10 characters: AAAAA9999A",
        raw: {},
      };
    }

    const provider = process.env.PAN_PROVIDER || "mock";

    if (provider === "surepass") {
      return PanService._verifySurepass(pan, nameAsOnPan);
    }

    return PanService._verifyMock(pan, nameAsOnPan);
  }

  // ── Live Surepass call ──────────────────────────────────────────────────────
  static async _verifySurepass(pan, nameAsOnPan) {
    const token = process.env.SUREPASS_TOKEN;
    if (!token) throw new Error("SUREPASS_TOKEN env variable is not set.");

    const response = await axios.post(
      "https://kyc-api.surepass.io/api/v1/pan/pan",
      { id_number: pan, get_name: true },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const d = response.data?.data ?? {};
    const registeredName = (d.full_name || "").toUpperCase();
    const submittedName  = (nameAsOnPan || "").toUpperCase().trim();
    const nameMatch      = PanService._fuzzyNameMatch(registeredName, submittedName);
    const isValid        = d.status === "VALID" && nameMatch;

    return {
      verified: isValid,
      name: registeredName,
      message: isValid
        ? "PAN verified successfully."
        : nameMatch
          ? "PAN is invalid or inactive."
          : "Name does not match PAN records.",
      raw: response.data,
    };
  }

  // ── Mock implementation (mirrors Surepass contract) ─────────────────────────
  static async _verifyMock(pan, nameAsOnPan) {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 400));

    const record = MOCK_VERIFIED_PANS[pan];

    if (!record) {
      return {
        verified: false,
        name: "",
        message: "PAN not found in records.",
        raw: { success: false, status_code: 422, message: "PAN not found" },
      };
    }

    const registeredName = record.name;
    const submittedName  = (nameAsOnPan || "").toUpperCase().trim();
    const nameMatch      = PanService._fuzzyNameMatch(registeredName, submittedName);
    const isValid        = record.status === "VALID" && nameMatch;

    return {
      verified: isValid,
      name: registeredName,
      message: isValid
        ? "PAN verified successfully."
        : "Name does not match PAN records.",
      raw: {
        success: isValid,
        status_code: isValid ? 200 : 422,
        data: {
          pan_number: pan,
          full_name:  registeredName,
          status:     record.status,
          name_match: nameMatch,
        },
      },
    };
  }

  // ── Fuzzy name matching ─────────────────────────────────────────────────────
  // Handles common mismatches: initials vs full name, word-order differences,
  // extra spaces, punctuation. Good enough for compliance — not cryptographic.
  static _fuzzyNameMatch(registeredName, submittedName) {
    if (!registeredName || !submittedName) return false;

    const clean = (s) =>
      s.toUpperCase()
       .replace(/[^A-Z\s]/g, "")
       .replace(/\s+/g, " ")
       .trim();

    const r = clean(registeredName);
    const s = clean(submittedName);

    if (r === s) return true;

    // Check if all submitted words appear in registered name (handles initials)
    const rWords = r.split(" ");
    const sWords = s.split(" ");

    return sWords.every((w) =>
      rWords.some((rw) => rw === w || rw.startsWith(w) || w.startsWith(rw))
    );
  }
}

module.exports = PanService;
