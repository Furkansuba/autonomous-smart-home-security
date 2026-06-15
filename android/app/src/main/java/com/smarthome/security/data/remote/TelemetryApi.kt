package com.smarthome.security.data.remote

import com.smarthome.security.data.model.HazardsResponse
import com.smarthome.security.data.model.TelemetryListResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

interface TelemetryApi {
    @GET("api/telemetry")
    suspend fun getTelemetryList(
        @Header("Authorization") token: String,
        @Query("limit") limit: Int,
    ): Response<TelemetryListResponse>

    @GET("api/telemetry/hazards")
    suspend fun getActiveHazards(
        @Header("Authorization") token: String,
    ): Response<HazardsResponse>
}
