package com.smarthome.security.ui.overrides

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.OverrideRequest
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.OverridesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class OverridesUiState {
    object Loading : OverridesUiState()
    data class Success(val overrides: List<OverrideRequest>) : OverridesUiState()
    data class Error(val message: String) : OverridesUiState()
    object SessionExpired : OverridesUiState()
}

sealed class SilenceAlarmState {
    object Idle : SilenceAlarmState()
    object Sending : SilenceAlarmState()
    object Success : SilenceAlarmState()
    data class Error(val message: String) : SilenceAlarmState()
    object SessionExpired : SilenceAlarmState()
}

class OverridesViewModel(private val repository: OverridesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<OverridesUiState>(OverridesUiState.Loading)
    val uiState: StateFlow<OverridesUiState> = _uiState.asStateFlow()

    private val _silenceState = MutableStateFlow<SilenceAlarmState>(SilenceAlarmState.Idle)
    val silenceState: StateFlow<SilenceAlarmState> = _silenceState.asStateFlow()

    init {
        loadOverrides()
    }

    fun loadOverrides() {
        _uiState.value = OverridesUiState.Loading
        viewModelScope.launch {
            val result = repository.getOverrides()
            _uiState.value = result.fold(
                onSuccess = { OverridesUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        OverridesUiState.SessionExpired
                    else
                        OverridesUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
    }

    fun silenceAlarm(adminEmail: String) {
        if (_silenceState.value is SilenceAlarmState.Sending) return
        _silenceState.value = SilenceAlarmState.Sending
        viewModelScope.launch {
            val result = repository.silenceAlarm(adminEmail)
            _silenceState.value = result.fold(
                onSuccess = { SilenceAlarmState.Success },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        SilenceAlarmState.SessionExpired
                    else
                        SilenceAlarmState.Error(error.message ?: "Unknown error.")
                },
            )
            if (result.isSuccess) {
                loadOverrides()
            }
        }
    }

    fun resetSilenceState() {
        _silenceState.value = SilenceAlarmState.Idle
    }
}

class OverridesViewModelFactory(private val repository: OverridesRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        OverridesViewModel(repository) as T
}
