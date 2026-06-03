package com.smarthome.security.ui.devices

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.model.Device
import com.smarthome.security.data.remote.SessionExpiredException
import com.smarthome.security.data.repository.DevicesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class DevicesUiState {
    object Loading : DevicesUiState()
    data class Success(val devices: List<Device>) : DevicesUiState()
    data class Error(val message: String) : DevicesUiState()
    object SessionExpired : DevicesUiState()
}

class DevicesViewModel(private val repository: DevicesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<DevicesUiState>(DevicesUiState.Loading)
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    init {
        loadDevices()
    }

    fun loadDevices() {
        _uiState.value = DevicesUiState.Loading
        viewModelScope.launch {
            val result = repository.getDevices()
            _uiState.value = result.fold(
                onSuccess = { DevicesUiState.Success(it) },
                onFailure = { error ->
                    if (error is SessionExpiredException)
                        DevicesUiState.SessionExpired
                    else
                        DevicesUiState.Error(error.message ?: "Unknown error.")
                },
            )
        }
    }
}

class DevicesViewModelFactory(private val repository: DevicesRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        DevicesViewModel(repository) as T
}
