package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.ActiveHazard
import com.smarthome.security.data.model.TelemetrySummary
import com.smarthome.security.data.remote.TelemetryApi
import com.smarthome.security.data.remote.SessionExpiredException

class TelemetryRepository(
    private val api: TelemetryApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getTelemetryList(): Result<List<TelemetrySummary>> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getTelemetryList("Bearer $token", limit = 100)
            when {
                response.isSuccessful -> {
                    val body = response.body()
                    if (body != null) Result.success(body.telemetry ?: emptyList())
                    else Result.failure(Exception("Empty response from server."))
                }
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                else -> Result.failure(Exception("Failed to load telemetry (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    // Best-effort: derived hazards are supplementary, so a failure here returns an
    // empty list rather than breaking the Sensors screen.
    suspend fun getActiveHazards(): List<ActiveHazard> {
        val token = sessionManager.getToken() ?: return emptyList()
        return try {
            val response = api.getActiveHazards("Bearer $token")
            if (response.isSuccessful) response.body()?.hazards ?: emptyList() else emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
