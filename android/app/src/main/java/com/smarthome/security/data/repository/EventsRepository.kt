package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.Event
import com.smarthome.security.data.remote.EventsApi
import com.smarthome.security.data.remote.SessionExpiredException

class EventsRepository(
    private val api: EventsApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getEvents(): Result<List<Event>> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getEvents("Bearer $token", limit = 100)
            when {
                response.isSuccessful -> Result.success(response.body()?.events ?: emptyList())
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                else -> Result.failure(Exception("Failed to load events (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
