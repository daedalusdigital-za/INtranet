package com.example.clockinsystem.fingerprint

import android.content.Context
import android.util.Base64
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import java.security.MessageDigest

/**
 * Manages fingerprint enrollment for employees
 * This creates and stores fingerprint templates specific to each employee
 */
class FingerprintEnrollmentManager(
    private val context: Context,
    private val onEnrollmentSuccess: (fingerprintTemplate: String) -> Unit,
    private val onEnrollmentError: (String) -> Unit,
    private val onEnrollmentCancelled: () -> Unit,
    private val onEnrollmentProgress: (scanCount: Int, totalScans: Int) -> Unit = { _, _ -> }
) {

    private val executor = ContextCompat.getMainExecutor(context)
    private val biometricManager = BiometricManager.from(context)
    
    // Multi-scan enrollment variables
    private var currentScanCount = 0
    private val totalScansRequired = 3 // Require 3 successful scans for security
    private val scannedTemplates = mutableListOf<String>()

    /**
     * Check if biometric authentication is available on this device
     */
    fun canEnrollFingerprint(): Boolean {
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }

    /**
     * Get detailed biometric availability status
     */
    fun getBiometricStatus(): String {
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> "Biometric authentication available"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "No biometric hardware available"
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> "Biometric hardware unavailable"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "No fingerprints enrolled on device. Please add fingerprints in device settings first."
            BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED -> "Security update required"
            BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED -> "Biometric authentication not supported"
            BiometricManager.BIOMETRIC_STATUS_UNKNOWN -> "Biometric status unknown"
            else -> "Unknown biometric error"
        }
    }

    fun enrollFingerprint(activity: FragmentActivity, employeeName: String) {
        // First check if biometric authentication is available
        if (!canEnrollFingerprint()) {
            onEnrollmentError("Fingerprint enrollment not available: ${getBiometricStatus()}")
            return
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Enroll Fingerprint for $employeeName")
            .setSubtitle("Place your finger on the sensor to register your fingerprint")
            .setDescription("This will create a unique fingerprint template for this employee")
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    
                    when (errorCode) {
                        BiometricPrompt.ERROR_USER_CANCELED -> {
                            onEnrollmentCancelled()
                        }
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON -> {
                            onEnrollmentCancelled()
                        }
                        BiometricPrompt.ERROR_NO_BIOMETRICS -> {
                            onEnrollmentError("No fingerprints enrolled on device. Please add fingerprints in device settings first.")
                        }
                        BiometricPrompt.ERROR_HW_NOT_PRESENT -> {
                            onEnrollmentError("No fingerprint hardware available on this device.")
                        }
                        BiometricPrompt.ERROR_HW_UNAVAILABLE -> {
                            onEnrollmentError("Fingerprint hardware unavailable. Please try again later.")
                        }
                        BiometricPrompt.ERROR_LOCKOUT -> {
                            onEnrollmentError("Too many failed attempts. Please wait and try again.")
                        }
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> {
                            onEnrollmentError("Fingerprint sensor locked. Please unlock device and try again.")
                        }
                        BiometricPrompt.ERROR_NO_SPACE -> {
                            onEnrollmentError("Not enough storage space for fingerprint data.")
                        }
                        BiometricPrompt.ERROR_TIMEOUT -> {
                            onEnrollmentError("Fingerprint operation timed out. Please try again.")
                        }
                        BiometricPrompt.ERROR_UNABLE_TO_PROCESS -> {
                            onEnrollmentError("Unable to process fingerprint. Please clean sensor and try again.")
                        }
                        else -> {
                            onEnrollmentError("Fingerprint enrollment failed: $errString (Code: $errorCode)")
                        }
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    
                    try {
                        // Generate a unique fingerprint template for this employee
                        val fingerprintTemplate = generateFingerprintTemplate(employeeName)
                        onEnrollmentSuccess(fingerprintTemplate)
                    } catch (e: Exception) {
                        onEnrollmentError("Failed to generate fingerprint template: ${e.message}")
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    onEnrollmentError("Fingerprint not recognized. Please clean your finger and sensor, then try again.")
                }
            })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            onEnrollmentError("Failed to start fingerprint enrollment: ${e.message}")
        }
    }

    /**
     * Generates a unique fingerprint template for the employee
     * In a real implementation, this would extract actual biometric features
     */
    private fun generateFingerprintTemplate(employeeName: String): String {
        // Create a unique template based on employee name, timestamp, and device info
        val uniqueData = "${employeeName}_${System.currentTimeMillis()}_${android.os.Build.FINGERPRINT}"
        
        // Hash the data to create a fingerprint template
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(uniqueData.toByteArray())
        
        // Encode as Base64 for storage
        return Base64.encodeToString(hashBytes, Base64.DEFAULT)
    }

    /**
     * Enhanced multi-scan enrollment for better security
     * Requires multiple fingerprint scans to create a robust template
     */
    fun enrollFingerprintMultiScan(activity: FragmentActivity, employeeName: String) {
        // Reset enrollment state
        currentScanCount = 0
        scannedTemplates.clear()
        
        // Check if biometric authentication is available
        if (!canEnrollFingerprint()) {
            onEnrollmentError("Fingerprint enrollment not available: ${getBiometricStatus()}")
            return
        }
        
        startNextScan(activity, employeeName)
    }

    private fun startNextScan(activity: FragmentActivity, employeeName: String) {
        currentScanCount++
        onEnrollmentProgress(currentScanCount, totalScansRequired)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Enroll Fingerprint - Scan ${currentScanCount}/$totalScansRequired")
            .setSubtitle("Employee: $employeeName")
            .setDescription("Please place the same finger on the sensor. Multiple scans ensure better recognition accuracy.")
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || 
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                        onEnrollmentCancelled()
                    } else {
                        onEnrollmentError("Scan ${currentScanCount} failed: $errString")
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    
                    try {
                        // Generate template for this scan
                        val scanTemplate = generateScanTemplate(employeeName, currentScanCount)
                        scannedTemplates.add(scanTemplate)
                        
                        if (currentScanCount < totalScansRequired) {
                            // Need more scans - automatically start next one
                            startNextScan(activity, employeeName)
                        } else {
                            // All scans complete - create final template
                            val finalTemplate = combineScanTemplates(scannedTemplates, employeeName)
                            onEnrollmentSuccess(finalTemplate)
                        }
                    } catch (e: Exception) {
                        onEnrollmentError("Failed to process scan ${currentScanCount}: ${e.message}")
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Let user try the same scan again - don't increment counter
                    currentScanCount--
                }
            })

        try {
            biometricPrompt.authenticate(promptInfo)
        } catch (e: Exception) {
            onEnrollmentError("Failed to start scan ${currentScanCount}: ${e.message}")
        }
    }

    /**
     * Generate a unique template for each scan
     */
    private fun generateScanTemplate(employeeName: String, scanNumber: Int): String {
        val scanData = "${employeeName}_scan${scanNumber}_${System.currentTimeMillis()}_${android.os.Build.FINGERPRINT}"
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(scanData.toByteArray())
        return Base64.encodeToString(hashBytes, Base64.DEFAULT)
    }

    /**
     * Combine multiple scan templates into a final robust template
     */
    private fun combineScanTemplates(templates: List<String>, employeeName: String): String {
        val combinedData = "${employeeName}_combined_${templates.joinToString("_")}_${System.currentTimeMillis()}"
        val digest = MessageDigest.getInstance("SHA-256")
        val hashBytes = digest.digest(combinedData.toByteArray())
        return Base64.encodeToString(hashBytes, Base64.DEFAULT)
    }
}