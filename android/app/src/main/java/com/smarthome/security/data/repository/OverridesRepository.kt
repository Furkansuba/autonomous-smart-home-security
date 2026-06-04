package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
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
}
