// Round before assigning signs/colours so displayed zero is always neutral.
const rounded = (value: number, digits: number) => {
  const result = Number(value.toFixed(digits));
  return Object.is(result, -0) ? 0 : result;
};

export const number = (value: number | null | undefined, digits = 2) =>
  value == null
    ? "—"
    : rounded(value, digits).toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export const signed = (value: number | null | undefined, digits = 2) =>
  value == null
    ? "—"
    : `${rounded(value, digits) > 0 ? "+" : ""}${number(value, digits)}`;
export const percent = (value: number | null | undefined, sign = true) =>
  value == null ? "—" : `${sign ? signed(value * 100) : number(value * 100)}%`;
export const price = (value: number | null | undefined, quote: string) =>
  number(value, quote === "JPY" ? 3 : 5);
export const shortDate = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—";
export const timestamp = (value: string | null) =>
  value
    ? `${new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`
    : "Unavailable";
export const tone = (value: number | null, scale = 1) => {
  if (value == null) return "muted";
  const displayed = rounded(value * scale, 2);
  return displayed > 0 ? "positive" : displayed < 0 ? "negative" : "neutral";
};
