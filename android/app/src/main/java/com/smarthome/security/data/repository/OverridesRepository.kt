package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.CreateOverrideRequest
import com.smarthome.security.data.model.OverrideRequest
import com.smarthome.security.data.remote.OverridesApi
import com.smarthome.security.data.remote.SessionExpiredException

class OverridesRepository(
    private val api: OverridesApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getOverrides(): Result<List<OverrideRequest>> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getOverrides("Bearer $token")
            when {
                response.isSuccessful -> Result.success(response.body()?.overrides ?: emptyList())
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                else -> Result.failure(Exception("Failed to load overrides (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    suspend fun silenceAlarm(adminEmail: String): Result<String> =
        sendSafeAction("buzzer_off", "buzzer_01", adminEmail)

    suspend fun sendSafeAction(action: String, actuatorId: String, adminEmail: String): Result<String> =
        submitOverride(action, actuatorId, adminEmail, "Admin override: $action")

    // Confirm Threat Cleared (false-alarm recovery). Admin-only, requires a reason.
    // The backend never demo-auto-acks it; the real device decides executed/failed.
    suspend fun sendMaintenanceReset(reason: String, adminEmail: String): Result<String> =
        submitOverride("maintenance_reset", "pump_01", adminEmail, reason)

    private suspend fun submitOverride(
        action: String,
        actuatorId: String,
        adminEmail: String,
        reason: String,
    ): Result<String> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        val body = CreateOverrideRequest(
            deviceId = "esp32_home_01",
            requestedBy = adminEmail,
            actuatorId = actuatorId,
            action = action,
            reason = reason,
        )
        return try {
            val response = api.createOverride("Bearer $token", body)
            when {
                response.isSuccessful -> {
                    // A 2xx can still be a safety block (e.g. pump_off during a fire) or a
                    // device-rejected maintenance_reset. Surface the real status/reason
                    // instead of a misleading "Command sent."
                    val override = response.body()?.override
                    val message = when (override?.status) {
                        "blocked" -> override.blockedReason ?: "Command blocked for safety."
                        "failed" -> override.blockedReason?.let { "Device rejected: $it" }
                            ?: "Device rejected the command."
                        else -> "Command sent."
                    }
                    Result.success(message)
                }
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                response.code() == 403 -> Result.failure(Exception("Permission denied. Admin role required."))
                response.code() == 400 -> Result.failure(Exception("Invalid request. A reason may be required."))
                else -> Result.failure(Exception("Failed to send command (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
