// Normalizes a phone number to its last 10 digits (the subscriber number
// without a country code), so "+7 900 123-45-67", "8(900)123-45-67" and
// "9001234567" all compare equal. Russian numbers are the only case this
// app needs to handle (RF-only staff), and this rule (compare the last 10
// digits) is robust to whether the leading country/trunk digit is
// present, and whichever of "+7"/"7"/"8" was used to enter it.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

// Extracts a phone number from the vCard text MAX sends as
// `ContactAttachment.payload.vcf_info` when a user taps a
// "request_contact" button. vCard TEL lines look like
// "TEL;TYPE=CELL:+79001234567" or "TEL:+7 900 123-45-67".
export function extractPhoneFromVcf(vcf: string): string | null {
  const match = vcf.match(/^TEL[^:\n]*:(.+)$/im);

  if (!match) {
    return null;
  }

  return match[1].trim();
}
