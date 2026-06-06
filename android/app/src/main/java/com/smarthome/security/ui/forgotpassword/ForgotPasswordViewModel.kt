package com.smarthome.security.ui.forgotpassword

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.smarthome.security.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ForgotPasswordStep {
    object Email : ForgotPasswordStep()
    data class Answer(val question: String) : ForgotPasswordStep()
    object Success : ForgotPasswordStep()
}

data class ForgotPasswordUiState(
    val step: ForgotPasswordStep = ForgotPasswordStep.Email,
    val isLoading: Boolean = false,
    val error: String? = null,
    val emailError: String? = null,
    val answerError: String? = null,
    val newPasswordError: String? = null,
    val confirmPasswordError: String? = null,
)

class ForgotPasswordViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ForgotPasswordUiState())
    val uiState: StateFlow<ForgotPasswordUiState> = _uiState.asStateFlow()

    private var pendingEmail: String = ""

    fun lookupQuestion(email: String) {
        val trimmed = email.trim()
        if (trimmed.isEmpty() || !android.util.Patterns.EMAIL_ADDRESS.matcher(trimmed).matches()) {
            _uiState.value = ForgotPasswordUiState(emailError = "Enter a valid email address.")
            return
        }
        pendingEmail = trimmed
        _uiState.value = ForgotPasswordUiState(isLoading = true)
        viewModelScope.launch {
            val result = repository.getRecoveryQuestion(trimmed)
            result.fold(
                onSuccess = { response ->
                    if (!response.configured || response.question == null) {
                        _uiState.value = ForgotPasswordUiState(
                            error = "Recovery is not configured for this account.",
                        )
                    } else {
                        _uiState.value = ForgotPasswordUiState(
                            step = ForgotPasswordStep.Answer(response.question),
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.value = ForgotPasswordUiState(
                        error = error.message ?: "Cannot reach server. Check your connection.",
                    )
                },
            )
        }
    }

    fun resetPassword(
        securityAnswer: String,
        newPassword: String,
        confirmPassword: String,
        currentQuestion: String,
    ) {
        val answerError = if (securityAnswer.isBlank()) "Please enter your security answer." else null
        val newPasswordError = when {
            newPassword.length < 8 -> "Password must be at least 8 characters."
            newPassword.none { it.isUpperCase() } -> "Password must contain at least one uppercase letter."
            newPassword.none { it.isDigit() } -> "Password must contain at least one digit."
            else -> null
        }
        val confirmPasswordError = if (newPassword != confirmPassword) "Passwords do not match." else null

        if (answerError != null || newPasswordError != null || confirmPasswordError != null) {
            _uiState.value = ForgotPasswordUiState(
                step = ForgotPasswordStep.Answer(currentQuestion),
                answerError = answerError,
                newPasswordError = newPasswordError,
                confirmPasswordError = confirmPasswordError,
            )
            return
        }

        _uiState.value = ForgotPasswordUiState(
            step = ForgotPasswordStep.Answer(currentQuestion),
            isLoading = true,
        )
        viewModelScope.launch {
            val result = repository.resetPassword(pendingEmail, securityAnswer.trim(), newPassword)
            result.fold(
                onSuccess = {
                    _uiState.value = ForgotPasswordUiState(step = ForgotPasswordStep.Success)
                },
                onFailure = { error ->
                    _uiState.value = ForgotPasswordUiState(
                        step = ForgotPasswordStep.Answer(currentQuestion),
                        error = error.message ?: "Password reset failed.",
                    )
                },
            )
        }
    }

    fun goBackToEmail() {
        _uiState.value = ForgotPasswordUiState()
    }
}

class ForgotPasswordViewModelFactory(private val repository: AuthRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        ForgotPasswordViewModel(repository) as T
}
