package com.smarthome.security.ui.telemetry

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.TelemetrySummary
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.TelemetryRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class TelemetryUiState {
    object Loading : TelemetryUiState()
    data class Success(val telemetry: TelemetrySummary) : TelemetryUiState()
    data class Error(val message: String) : TelemetryUiState()
    object SessionExpired : TelemetryUiState()
}

class TelemetryViewModel(private val repository: TelemetryRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<TelemetryUiState>(TelemetryUiState.Loading)
    val uiState: StateFlow<TelemetryUiState> = _uiState.asStateFlow()

    init {
        loadTelemetry()
    }

    fun loadTelemetry() {
        _uiState.value = TelemetryUiState.Loading
        viewModelScope.launch {
            val result = repository.getLatestTelemetry()
            _uiState.value = result.fold(
                onSuccess = { TelemetryUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        TelemetryUiState.SessionExpired
                    else
                        TelemetryUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
    }
}

class TelemetryViewModelFactory(private val repository: TelemetryRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        TelemetryViewModel(repository) as T
}
