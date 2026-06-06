package com.smarthome.security.ui.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class RegisterUiState(
    val isLoading: Boolean = false,
    val serverError: String? = null,
    val fullNameError: String? = null,
    val emailError: String? = null,
    val passwordError: String? = null,
    val confirmPasswordError: String? = null,
    val securityQuestionError: String? = null,
    val securityAnswerError: String? = null,
)

class RegisterViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    fun register(
        fullName: String,
        email: String,
        password: String,
        confirmPassword: String,
        adminKey: String,
        securityQuestion: String,
        securityAnswer: String,
        onSuccess: () -> Unit,
    ) {
        val trimmedName = fullName.trim()
        val trimmedEmail = email.trim()

        val fullNameError = when {
            trimmedName.isEmpty() -> "Full name is required."
            trimmedName.length < 2 -> "Full name must be at least 2 characters."
            trimmedName.none { it.isLetter() } -> "Full name must include at least one letter."
            else -> null
        }
        val emailError = when {
            trimmedEmail.isEmpty() -> "Email is required."
            !android.util.Patterns.EMAIL_ADDRESS.matcher(trimmedEmail).matches() ->
                "Enter a valid email address."
            else -> null
        }
        val passwordError = when {
            password.length < 8 -> "Password must be at least 8 characters."
            password.none { it.isUpperCase() } -> "Password must contain at least one uppercase letter."
            password.none { it.isDigit() } -> "Password must contain at least one digit."
            else -> null
        }
        val confirmPasswordError = when {
            confirmPassword != password -> "Passwords do not match."
            else -> null
        }
        val securityQuestionError = if (securityQuestion.isBlank()) "Please select a security question." else null
        val securityAnswerError = if (securityAnswer.isBlank()) "Please enter a security answer." else null

        if (fullNameError != null || emailError != null || passwordError != null ||
            confirmPasswordError != null || securityQuestionError != null || securityAnswerError != null
        ) {
            _uiState.value = RegisterUiState(
                fullNameError = fullNameError,
                emailError = emailError,
                passwordError = passwordError,
                confirmPasswordError = confirmPasswordError,
                securityQuestionError = securityQuestionError,
                securityAnswerError = securityAnswerError,
            )
            return
        }

        _uiState.value = RegisterUiState(isLoading = true)
        viewModelScope.launch {
            val result = repository.register(
                fullName = trimmedName,
                email = trimmedEmail,
                password = password,
                adminKey = adminKey,
                securityQuestion = securityQuestion,
                securityAnswer = securityAnswer.trim(),
            )
            result.fold(
                onSuccess = {
                    _uiState.value = RegisterUiState()
                    onSuccess()
                },
                onFailure = { error ->
                    _uiState.value = RegisterUiState(serverError = error.message ?: "Registration failed.")
                },
            )
        }
    }
}

class RegisterViewModelFactory(private val repository: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        RegisterViewModel(repository) as T
}
