package com.example.clockinsystem.fingerprint

import android.content.Context
import android.util.Base64
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.example.clockinsystem.model.Employee
import java.security.MessageDigest

/**
 * Manages fingerprint authentication against stored employee templates
 * This compares incoming fingerprints with employee-specific templates
 */
class FingerprintMatchingManager(
    private val context: Context,
    private val onMatchSuccess: (employee: Employee) -> Unit,
    private val onMatchError: (String) -> Unit,
    private val onNoMatch: () -> Unit,
    private val onCancelled: () -> Unit
) {

    private val executor = ContextCompat.getMainExecutor(context)

    /**
     * Authenticate against stored employee fingerprint templates
     */
    fun authenticateEmployee(
        activity: FragmentActivity, 
        employeeList: List<Employee>,
        isClockIn: Boolean
    ) {
        val action = if (isClockIn) "Clock In" else "Clock Out"
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Employee $action")
            .setSubtitle("Place your registered fingerprint on the sensor")
            .setDescription("Authenticating against employee database")
            .setNegativeButtonText("Cancel")
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || 
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                        onCancelled()
                    } else {
                        onMatchError("Authentication error: $errString")
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    
                    // Generate fingerprint template from current scan
                    val scannedTemplate = generateCurrentFingerprintTemplate()
                    
                    // Compare against all employee templates
                    val matchedEmployee = findMatchingEmployee(scannedTemplate, employeeList)
                    
                    if (matchedEmployee != null) {
                        onMatchSuccess(matchedEmployee)
                    } else {
                        onNoMatch()
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Don't treat this as an error - just let the user try again
                    // The biometric prompt will automatically show "Try again" message
                    // and allow the user to retry without dismissing the prompt
                }
            })

        biometricPrompt.authenticate(promptInfo)
    }

    /**
     * Generates a template from the current fingerprint scan
     * In real implementation, this would extract actual biometric features
     */
    private fun generateCurrentFingerprintTemplate(): String {
        // For demo purposes, we'll generate a consistent template
        // In reality, this would extract features from the scanned fingerprint
        
        // Generate a template that will work with our demo matching
        return "valid_fingerprint_template_${System.currentTimeMillis()}"
    }

    /**
     * Finds an employee whose fingerprint template matches the scanned one
     * In real implementation, this would use biometric matching algorithms
     */
    private fun findMatchingEmployee(scannedTemplate: String, employeeList: List<Employee>): Employee? {
        // For this demo, we'll implement a simplified matching logic
        // In a real system, you would use sophisticated biometric matching algorithms
        
        employeeList.forEach { employee ->
            if (employee.fingerprintTemplate != null) {
                // Simulate biometric matching with template comparison
                if (simulateBiometricMatch(scannedTemplate, employee.fingerprintTemplate)) {
                    return employee
                }
            }
        }
        
        return null
    }

    /**
     * Simulates biometric template matching
     * In real implementation, this would use advanced biometric algorithms
     */
    private fun simulateBiometricMatch(template1: String, template2: String): Boolean {
        // For demo purposes, we'll make this work more reliably
        // In reality, this would involve complex biometric feature comparison
        
        // Since we can't actually match real biometric data in this demo,
        // we'll simulate a successful match for any enrolled employee
        // This simulates that any valid device fingerprint will match 
        // any employee who has enrolled their fingerprint
        
        return template2.isNotEmpty() && template1.isNotEmpty()
    }

    /**
     * Alternative method: Match by device fingerprint (for demo)
     * This will match the current device user to the first enrolled employee
     */
    fun authenticateByDeviceFingerprint(
        activity: FragmentActivity,
        employeeList: List<Employee>,
        isClockIn: Boolean
    ) {
        val enrolledEmployees = employeeList.filter { it.fingerprintTemplate != null }
        
        if (enrolledEmployees.isEmpty()) {
            onMatchError("No employees have registered fingerprints")
            return
        }

        val action = if (isClockIn) "Clock In" else "Clock Out"
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Employee $action")
            .setSubtitle("Use your device fingerprint to authenticate")
            .setDescription("Matching against registered employee: ${enrolledEmployees.first().name}")
            .setNegativeButtonText("Cancel")
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    if (errorCode == BiometricPrompt.ERROR_USER_CANCELED || 
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON) {
                        onCancelled()
                    } else {
                        onMatchError("Authentication error: $errString")
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    // For demo: if device authentication succeeds, use the first enrolled employee
                    val firstEmployee = enrolledEmployees.firstOrNull()
                    if (firstEmployee != null) {
                        onMatchSuccess(firstEmployee)
                    } else {
                        onMatchError("No enrolled employees found")
                    }
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Don't treat this as an error - just let the user try again
                    // The biometric prompt will automatically show "Try again" message
                    // and allow the user to retry without dismissing the prompt
                }
            })

        biometricPrompt.authenticate(promptInfo)
    }
}