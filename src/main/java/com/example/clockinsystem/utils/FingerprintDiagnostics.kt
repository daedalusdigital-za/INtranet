package com.example.clockinsystem.utils

import android.content.Context
import androidx.biometric.BiometricManager

/**
 * Utility class for diagnosing fingerprint and biometric issues
 */
object FingerprintDiagnostics {
    
    /**
     * Performs a comprehensive check of fingerprint capabilities
     */
    fun diagnoseFingerprintIssues(context: Context): FingerprintDiagnosisResult {
        val biometricManager = BiometricManager.from(context)
        
        val strongAuthStatus = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        val weakAuthStatus = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
        val deviceCredentialStatus = biometricManager.canAuthenticate(BiometricManager.Authenticators.DEVICE_CREDENTIAL)
        
        return FingerprintDiagnosisResult(
            canUseStrongBiometrics = strongAuthStatus == BiometricManager.BIOMETRIC_SUCCESS,
            canUseWeakBiometrics = weakAuthStatus == BiometricManager.BIOMETRIC_SUCCESS,
            canUseDeviceCredential = deviceCredentialStatus == BiometricManager.BIOMETRIC_SUCCESS,
            strongBiometricStatus = getStatusString(strongAuthStatus),
            weakBiometricStatus = getStatusString(weakAuthStatus),
            deviceCredentialStatus = getStatusString(deviceCredentialStatus),
            recommendations = generateRecommendations(strongAuthStatus)
        )
    }
    
    private fun getStatusString(status: Int): String {
        return when (status) {
            BiometricManager.BIOMETRIC_SUCCESS -> "Available"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "No biometric hardware"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "Hardware unavailable"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "No fingerprints enrolled"
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "Security update required"
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> "Not supported"
            BiometricManager.BIOMETRIC_STATUS_UNKNOWN -> "Status unknown"
            else -> "Unknown error (code: $status)"
        }
    }
    
    private fun generateRecommendations(status: Int): List<String> {
        return when (status) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                listOf("Fingerprint authentication is ready to use!")
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                listOf(
                    "This device doesn't have a fingerprint sensor",
                    "Consider using device PIN/password authentication instead"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                listOf(
                    "Fingerprint sensor is temporarily unavailable",
                    "Try restarting the app",
                    "Check if another app is using the fingerprint sensor",
                    "Restart the device if the issue persists"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                listOf(
                    "No fingerprints are registered on this device",
                    "Go to Settings > Security > Fingerprint",
                    "Add at least one fingerprint",
                    "Return to the app and try again"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> {
                listOf(
                    "Device needs a security update",
                    "Go to Settings > System Update",
                    "Install available updates",
                    "Restart device after updating"
                )
            }
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> {
                listOf(
                    "Biometric authentication is not supported",
                    "This may be due to device policy restrictions",
                    "Contact your device administrator if this is a managed device"
                )
            }
            else -> {
                listOf(
                    "Unknown fingerprint issue detected",
                    "Try restarting the app",
                    "Check device settings for fingerprint configuration",
                    "Contact support if the issue persists"
                )
            }
        }
    }
}

data class FingerprintDiagnosisResult(
    val canUseStrongBiometrics: Boolean,
    val canUseWeakBiometrics: Boolean,
    val canUseDeviceCredential: Boolean,
    val strongBiometricStatus: String,
    val weakBiometricStatus: String,
    val deviceCredentialStatus: String,
    val recommendations: List<String>
)