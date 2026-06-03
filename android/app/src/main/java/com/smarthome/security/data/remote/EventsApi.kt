package com.smarthome.security.data.remote

import com.smarthome.security.data.model.EventsResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

interface EventsApi {
    @GET("api/events")
    suspend fun getEvents(
        @Header("Authorization") token: String,
    ): Response<EventsResponse>
}
