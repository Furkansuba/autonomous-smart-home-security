package com.smarthome.security.data.remote

import com.smarthome.security.data.model.FcmTokenRequest
import com.smarthome.security.data.model.UpdateRoleRequest
import com.smarthome.security.data.model.UpdateRoleResponse
import com.smarthome.security.data.model.UsersListResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface UsersApi {
    @POST("api/users/fcm-token")
    suspend fun registerFcmToken(
        @Header("Authorization") authorization: String,
        @Body body: FcmTokenRequest,
    ): Response<Unit>

    @GET("api/users")
    suspend fun getUsers(
        @Header("Authorization") authorization: String,
    ): Response<UsersListResponse>

    @PATCH("api/users/{user_id}/role")
    suspend fun promoteToAdmin(
        @Header("Authorization") authorization: String,
        @Path("user_id") userId: String,
        @Body body: UpdateRoleRequest,
    ): Response<UpdateRoleResponse>
}
