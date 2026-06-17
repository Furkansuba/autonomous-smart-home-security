package com.smarthome.security.util

/**
 * UI-only friendly labels for raw backend `event_type` values.
 *
 * The raw event_type is still used everywhere for filtering, sorting, icon selection,
 * and API logic — only the visible text is mapped here. Unknown types fall back to a
 * humanized form ("reed switch opened" style) so nothing ever renders blank.
 */
object EventLabels {
    private val LABELS = mapOf(
        "reed_switch_opened" to "Window/Door Opened",
        "vibration_detected" to "Impact / Vibration Detected",
        "gas_detected" to "Gas Detected",
        "co_detected" to "Carbon Monoxide Detected",
        "fire_detected" to "Fire Detected",
        "motion_detected" to "Motion Detected",
        "intrusion_detected" to "Intrusion Detected",
    )

    fun format(eventType: String): String =
        LABELS[eventType] ?: eventType.replace('_', ' ').replaceFirstChar { it.uppercase() }
}
