package com.smarthome.security.data.repository

import com.smarthome.security.data.local.SessionManager
import com.smarthome.security.data.model.UpdateRoleRequest
import com.smarthome.security.data.model.UserListItem
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.remote.UsersApi

class UsersRepository(
    private val api: UsersApi,
    private val sessionManager: SessionManager,
) {
    suspend fun getUsers(): Result<List<UserListItem>> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.getUsers("Bearer $token")
            when {
                response.isSuccessful -> Result.success(response.body()?.users ?: emptyList())
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                response.code() == 403 -> Result.failure(Exception("Admin role required."))
                else -> Result.failure(Exception("Failed to load users (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }

    suspend fun promoteToAdmin(userId: String): Result<UserListItem> {
        val token = sessionManager.getToken()
            ?: return Result.failure(Exception("Session not found. Please log in again."))
        return try {
            val response = api.promoteToAdmin("Bearer $token", userId, UpdateRoleRequest("admin"))
            when {
                response.isSuccessful -> Result.success(response.body()!!.user)
                response.code() == 401 -> {
                    sessionManager.clearSession()
                    Result.failure(SessionExpiredException())
                }
                response.code() == 403 -> Result.failure(Exception("Admin role required."))
                response.code() == 404 -> Result.failure(Exception("User not found."))
                else -> Result.failure(Exception("Failed to promote user (${response.code()})."))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Cannot reach server. Check your connection."))
        }
    }
}
