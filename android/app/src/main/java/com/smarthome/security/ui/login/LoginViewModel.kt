package com.smarthome.security.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoginUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class LoginViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    val hasStoredSession: Boolean get() = repository.hasStoredSession()

    fun login(email: String, password: String, onSuccess: () -> Unit) {
        _uiState.value = LoginUiState(isLoading = true)
        viewModelScope.launch {
            val result = repository.login(email, password)
            result.fold(
                onSuccess = {
                    _uiState.value = LoginUiState()
                    onSuccess()
                },
                onFailure = { error ->
                    _uiState.value = LoginUiState(errorMessage = error.message ?: "Login failed.")
                },
            )
        }
    }
}

class LoginViewModelFactory(private val repository: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        LoginViewModel(repository) as T
}
