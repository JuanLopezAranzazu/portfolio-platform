import "dotenv/config";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { readFileSync } from "fs";

const url = process.env.CLOUDFRONT_PRIVATE_URL;
const keyPairId = process.env.KEY_PAIR_ID;

if (!url || !keyPairId) {
  throw new Error(
    "Missing CLOUDFRONT_PRIVATE_URL or KEY_PAIR_ID environment variables",
  );
}

const privateKey = readFileSync("keys/cloudfront-private-key.pem", "utf8");

const signedUrl = getSignedUrl({
  url,
  keyPairId,
  privateKey,
  dateLessThan: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
});

console.log(signedUrl);
