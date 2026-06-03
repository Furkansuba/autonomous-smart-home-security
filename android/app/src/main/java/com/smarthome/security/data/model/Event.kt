package com.smarthome.security.data.model

import com.google.gson.annotations.SerializedName

data class Event(
    @SerializedName("event_id") val eventId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("room_id") val roomId: String?,
    @SerializedName("event_type") val eventType: String,
    val severity: String,
    val message: String?,
    val confirmed: Boolean?,
    @SerializedName("occurred_at") val occurredAt: String,
)

data class EventsResponse(
    val count: Int,
    val total: Int,
    val page: Int,
    val limit: Int,
    @SerializedName("total_pages") val totalPages: Int,
    val events: List<Event>,
)
