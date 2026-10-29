/** Preserve the supplied number; use equivalent keys only to detect duplicates. */
export function normalizePhone(
  value: unknown,
  country: unknown = "Nigeria",
): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim().normalize("NFC");
  // Scientific notation has often already lost digits. Never expand or pad it.
  if (/[eE]/.test(text)) return text;
  let phone = text.replace(/[\s()\-.]/g, "");
  if (/^234\d{10}$/.test(phone)) phone = "+" + phone;
  if (
    String(country).trim().toLowerCase() === "nigeria" &&
    /^[789]\d{9}$/.test(phone)
  )
    phone = "0" + phone;
  return phone;
}
export function phoneKeys(value: unknown): string[] {
  const phone = String(normalizePhone(value, "") ?? "");
  if (/^0[789]\d{9}$/.test(phone))
    return [phone, "+234" + phone.slice(1), "234" + phone.slice(1)];
  if (/^\+?234[789]\d{9}$/.test(phone)) {
    const digits = phone.replace(/^\+/, "");
    return ["0" + digits.slice(3), "+" + digits, digits];
  }
  return phone ? [phone] : [];
}
export function canonicalPhone(value: unknown) {
  return phoneKeys(value)[0] || "";
}
