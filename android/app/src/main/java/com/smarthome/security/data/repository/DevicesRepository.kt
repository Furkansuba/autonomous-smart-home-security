package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.Device
import com.smarthome.security.data.remote.DevicesApi
import com.smarthome.security.data.remote.SessionExpiredException

class DevicesRepository(
    private val api: DevicesApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getDevices(): Result<List<Device>> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getDevices("Bearer $token")
            when {
                response.isSuccessful -> Result.success(response.body()?.devices ?: emptyList())
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                else -> Result.failure(Exception("Failed to load devices (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
