package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.DashboardSummary
import com.smarthome.security.data.remote.DashboardApi

class DashboardRepository(
    private val api: DashboardApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getSummary(): Result<DashboardSummary> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getSummary("Bearer $token")
            when {
                response.isSuccessful -> Result.success(response.body()!!)
                response.code() == 401 -> Result.failure(Exception("Session expired. Please log in again."))
                else -> Result.failure(Exception("Failed to load dashboard (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
