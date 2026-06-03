package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.TelemetrySummary
import com.smarthome.security.data.remote.TelemetryApi

class TelemetryRepository(
    private val api: TelemetryApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getLatestTelemetry(): Result<TelemetrySummary> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getLatestTelemetry("Bearer $token")
            when {
                response.isSuccessful -> {
                    val body = response.body()
                    if (body != null) Result.success(body.telemetry)
                    else Result.failure(Exception("Empty response from server."))
                }
                response.code() == 401 -> Result.failure(Exception("Session expired. Please log in again."))
                response.code() == 404 -> Result.failure(Exception("No telemetry data found yet."))
                else -> Result.failure(Exception("Failed to load telemetry (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
