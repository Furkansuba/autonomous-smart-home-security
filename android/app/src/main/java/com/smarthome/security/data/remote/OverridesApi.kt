package com.smarthome.security.data.remote

import com.smarthome.security.data.model.OverridesResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface OverridesApi {
    @GET("api/overrides")
    suspend fun getOverrides(
        @Header("Authorization") token: String,
    ): Response<OverridesResponse>
}
