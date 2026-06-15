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

sealed class OverrideActionState {
    object Idle : OverrideActionState()
    object Sending : OverrideActionState()
    data class Success(val message: String) : OverrideActionState()
    data class Error(val message: String) : OverrideActionState()
    object SessionExpired : OverrideActionState()
}

class OverridesViewModel(private val repository: OverridesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<OverridesUiState>(OverridesUiState.Loading)
    val uiState: StateFlow<OverridesUiState> = _uiState.asStateFlow()

    private val _overrideActionState = MutableStateFlow<OverrideActionState>(OverrideActionState.Idle)
    val overrideActionState: StateFlow<OverrideActionState> = _overrideActionState.asStateFlow()

    private val _activeAction = MutableStateFlow<String?>(null)
    val activeAction: StateFlow<String?> = _activeAction.asStateFlow()

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

    fun sendSafeAction(action: String, actuatorId: String, adminEmail: String) {
        if (_overrideActionState.value is OverrideActionState.Sending) return
        _overrideActionState.value = OverrideActionState.Sending
        _activeAction.value = action
        viewModelScope.launch {
            val result = repository.sendSafeAction(action, actuatorId, adminEmail)
            _overrideActionState.value = result.fold(
                onSuccess = { OverrideActionState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        OverrideActionState.SessionExpired
                    else
                        OverrideActionState.Error(error.message ?: "Unknown error.")
                },
            )
            _activeAction.value = null
            if (result.isSuccess) loadOverrides()
        }
    }

    fun sendMaintenanceReset(reason: String, adminEmail: String) {
        if (_overrideActionState.value is OverrideActionState.Sending) return
        if (reason.isBlank()) {
            _overrideActionState.value =
                OverrideActionState.Error("A reason is required to confirm the threat is cleared.")
            return
        }
        _overrideActionState.value = OverrideActionState.Sending
        _activeAction.value = "maintenance_reset"
        viewModelScope.launch {
            val result = repository.sendMaintenanceReset(reason, adminEmail)
            _overrideActionState.value = result.fold(
                onSuccess = { OverrideActionState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        OverrideActionState.SessionExpired
                    else
                        OverrideActionState.Error(error.message ?: "Unknown error.")
                },
            )
            _activeAction.value = null
            if (result.isSuccess) loadOverrides()
        }
    }

    fun resetOverrideActionState() {
        _overrideActionState.value = OverrideActionState.Idle
    }
}

class OverridesViewModelFactory(private val repository: OverridesRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        OverridesViewModel(repository) as T
}
