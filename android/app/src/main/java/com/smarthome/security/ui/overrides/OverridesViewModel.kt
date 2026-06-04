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

class OverridesViewModel(private val repository: OverridesRepository) : ViewModel() {
    private val _uiState = MutableStateFlow<OverridesUiState>(OverridesUiState.Loading)
    val uiState: StateFlow<OverridesUiState> = _uiState.asStateFlow()

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
}

class OverridesViewModelFactory(private val repository: OverridesRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        OverridesViewModel(repository) as T
}
