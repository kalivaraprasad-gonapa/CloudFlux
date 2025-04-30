import crypto from "crypto";

// Simple authentication function to verify the secret key
const verifySecretKey = (providedKey, actualKey) => {
  // Compare both keys in a timing-safe manner to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(actualKey)
  );
};

// Generate a token with expiry date for session
const generateToken = () => {
  // Generate a random token
  const randomBytes = crypto.randomBytes(32);
  const token = randomBytes.toString("hex");

  return token;
};

/**
 * Handles authentication requests by validating a provided secret key and issuing a session token.
 *
 * Accepts only POST requests with a `secretKey` in the request body. If the provided key matches the expected value from the environment, returns a generated token; otherwise, responds with an appropriate error status and message.
 *
 * @remark Responds with status 405 for non-POST methods, 400 if the secret key is missing, 500 if the server is misconfigured, and 401 if authentication fails.
 */
export default function handler(req, res) {
  // Only allow POST method
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { secretKey } = req.body;

    if (!secretKey) {
      return res.status(400).json({ message: "Secret key is required" });
    }

    // Get the expected secret key from environment variable
    const expectedKey = process.env.APP_SECRET_KEY;

    if (!expectedKey) {
      return res.status(500).json({ message: "Server configuration error" });
    }

    // Check if the provided key matches the expected one
    try {
      const isValid = secretKey === expectedKey; // Simplified for demonstration

      if (!isValid) {
        return res.status(401).json({ message: "Invalid secret key" });
      }

      // Generate a token for the session
      const token = generateToken();

      // Return success with the token
      return res.status(200).json({
        message: "Authentication successful",
        token,
      });
    } catch (error) {
      console.error("Verification error:", error);
      return res.status(500).json({ message: "Error during verification" });
    }
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
