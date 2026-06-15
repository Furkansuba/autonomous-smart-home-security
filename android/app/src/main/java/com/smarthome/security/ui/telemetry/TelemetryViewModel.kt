package com.smarthome.security.ui.telemetry

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.ActiveHazard
import com.smarthome.security.data.model.TelemetrySummary
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.TelemetryRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

sealed class TelemetryUiState {
    object Loading : TelemetryUiState()
    data class Success(
        val readings: List<TelemetrySummary>,
        val hazards: List<ActiveHazard>,
        val lastUpdatedAt: String?,
        val isStale: Boolean,
    ) : TelemetryUiState()
    object Empty : TelemetryUiState()
    data class Error(val message: String) : TelemetryUiState()
    object SessionExpired : TelemetryUiState()
}

class TelemetryViewModel(private val repository: TelemetryRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<TelemetryUiState>(TelemetryUiState.Loading)
    val uiState: StateFlow<TelemetryUiState> = _uiState.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private var autoRefreshJob: Job? = null

    private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    init {
        loadTelemetry()
    }

    fun loadTelemetry() {
        _uiState.value = TelemetryUiState.Loading
        viewModelScope.launch { fetchAndProcess() }
    }

    fun refresh() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            fetchAndProcess()
            _isRefreshing.value = false
        }
    }

    fun startAutoRefresh() {
        stopAutoRefresh()
        autoRefreshJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                fetchAndProcess()
            }
        }
    }

    fun stopAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = null
    }

    private suspend fun fetchAndProcess() {
        // Derived hazards are best-effort and supplementary to the telemetry list.
        val hazards = repository.getActiveHazards()
        val result = repository.getTelemetryList()
        _uiState.value = result.fold(
            onSuccess = { readings ->
                if (readings.isEmpty() && hazards.isEmpty()) TelemetryUiState.Empty
                else processReadings(readings, hazards)
            },
            onFailure = { error ->
                if (error is SessionExpiredException) TelemetryUiState.SessionExpired
                else TelemetryUiState.Error(error.message ?: "Unknown error.")
            },
        )
    }

    private fun processReadings(
        all: List<TelemetrySummary>,
        hazards: List<ActiveHazard>,
    ): TelemetryUiState.Success {
        val deduplicated = all
            .sortedByDescending { it.occurredAt ?: it.createdAt ?: "" }
            .distinctBy { it.roomId ?: it.deviceId }

        val newestTimestamp = deduplicated.firstOrNull()?.let { it.occurredAt ?: it.createdAt }

        val isStale = newestTimestamp?.let {
            try {
                val ageSeconds = Instant.now().epochSecond - Instant.parse(it).epochSecond
                ageSeconds > 300
            } catch (e: Exception) { false }
        } ?: false

        val lastUpdatedAt = newestTimestamp?.let {
            try { Instant.parse(it).atZone(ZoneId.systemDefault()).format(timeFormatter) }
            catch (e: Exception) { null }
        }

        return TelemetryUiState.Success(
            readings = deduplicated,
            hazards = hazards,
            lastUpdatedAt = lastUpdatedAt,
            isStale = isStale,
        )
    }
}

class TelemetryViewModelFactory(private val repository: TelemetryRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        TelemetryViewModel(repository) as T
}
