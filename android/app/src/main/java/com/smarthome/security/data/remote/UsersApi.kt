package com.smarthome.security.data.remote

import com.smarthome.security.data.model.FcmTokenRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface UsersApi {
    @POST("api/users/fcm-token")
    suspend fun registerFcmToken(
        @Header("Authorization") authorization: String,
        @Body body: FcmTokenRequest,
    ): Response<Unit>
}
