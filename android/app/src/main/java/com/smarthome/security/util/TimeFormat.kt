package com.smarthome.security.util

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Central timestamp formatting for the UI layer.
 *
 * The backend stores and returns UTC ISO-8601 timestamps (e.g. "2026-06-16T14:35:00Z").
 * These helpers convert them to the DEVICE'S LOCAL timezone for display only — they do
 * not change any data or model. Null/blank/unparseable input renders as a dash.
 *
 * Formats are 24-hour and day-first (Turkish-friendly), aligned with the app style:
 *  - dateTime("2026-06-16T14:35:00Z") -> "16 Jun 2026 14:35" (local)
 *  - time("2026-06-16T14:35:00Z")     -> "14:35" (local)
 */
object TimeFormat {
    const val PLACEHOLDER = "—"

    private val DATE_TIME = DateTimeFormatter.ofPattern("d MMM yyyy HH:mm", Locale.US)
    private val TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.US)

    /** Absolute local date+time, e.g. "16 Jun 2026 14:35". */
    fun dateTime(raw: String?): String = format(raw, DATE_TIME)

    /** Local time of day, e.g. "14:35". */
    fun time(raw: String?): String = format(raw, TIME)

    private fun format(raw: String?, formatter: DateTimeFormatter): String {
        val instant = parse(raw) ?: return PLACEHOLDER
        return instant.atZone(ZoneId.systemDefault()).format(formatter)
    }

    /** Parse a UTC/offset ISO-8601 string to an Instant; null if blank or unparseable. */
    private fun parse(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        return try {
            Instant.parse(raw) // handles trailing 'Z', with or without fractional seconds
        } catch (e: Exception) {
            try {
                OffsetDateTime.parse(raw).toInstant() // handles explicit offsets like +03:00
            } catch (e2: Exception) {
                null
            }
        }
    }
}
