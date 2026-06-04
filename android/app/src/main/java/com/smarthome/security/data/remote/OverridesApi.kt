package com.smarthome.security.data.remote

import com.smarthome.security.data.model.CreateOverrideRequest
import com.smarthome.security.data.model.CreateOverrideResponse
import com.smarthome.security.data.model.OverridesResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface OverridesApi {
    @GET("api/overrides")
    suspend fun getOverrides(
        @Header("Authorization") token: String,
    ): Response<OverridesResponse>

    @POST("api/overrides")
    suspend fun createOverride(
        @Header("Authorization") token: String,
        @Body body: CreateOverrideRequest,
    ): Response<CreateOverrideResponse>
}
