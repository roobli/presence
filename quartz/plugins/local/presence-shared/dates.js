import { isZh } from "./locale.js"

// Dates for the page header meta line and the index rows, formatted from the
// literal YYYY-MM-DD string. Going through a Date in the build machine's time
// zone can move a day.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * The YYYY-MM-DD part of a frontmatter date, or null. note-properties parses
 * YAML with the JSON schema, so dates arrive as that literal string. A Date
 * from another parser is read in UTC, which is how YAML defines timestamps.
 */
export function isoDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  if (typeof value !== "string") return null
  const match = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(value.trim())
  if (!match) return null
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return match[0]
}

/** "Sep 11, 2026" in English, "2026年9月11日" in Chinese. */
export function formatDate(iso, lang) {
  const [year, month, day] = iso.split("-").map(Number)
  return isZh(lang) ? `${year}年${month}月${day}日` : `${MONTHS[month - 1]} ${day}, ${year}`
}

/**
 * The HH:MM of a frontmatter date that carries a time, as written, or null.
 * A post is dated 2026-09-30T21:40+08:00: the clock is the author's, so it is
 * read from the string rather than converted to the build machine's zone.
 */
export function clockOf(value) {
  if (typeof value !== "string") return null
  const match = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours < 24 && minutes < 60 ? `${match[1]}:${match[2]}` : null
}

/**
 * Milliseconds since the epoch for ordering entries of one day, or null. A
 * value without an offset is read as UTC, date-only as midnight, so the order
 * never depends on the build machine's zone.
 */
export function instantOf(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value !== "string" || !isoDate(value)) return null
  let text = value.trim().replace(" ", "T")
  if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) text += "Z"
  const time = Date.parse(text)
  return Number.isNaN(time) ? null : time
}
