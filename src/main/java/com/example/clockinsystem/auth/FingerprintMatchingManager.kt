package com.example.clockinsystem.auth

import android.content.Context
import com.example.clockinsystem.model.Employee
import kotlinx.coroutines.delay

/**
 * Simple fingerprint matching manager for employee authentication
 * This handles employee-specific fingerprint verification
 */
class FingerprintMatchingManager(private val context: Context) {

    /**
     * Authenticate an employee using their fingerprint
     * In a real app, this would compare against stored fingerprint templates
     * For demo purposes, we'll simulate the authentication process
     */
    suspend fun authenticateEmployee(employee: Employee): Boolean {
        // Simulate fingerprint scanning delay
        delay(1500)
        
        // Simulate fingerprint matching logic
        // In a real implementation, this would:
        // 1. Access the device's fingerprint sensor
        // 2. Compare the scanned fingerprint with the employee's stored template
        // 3. Return true if they match, false otherwise
        
        // For demo purposes, we'll check if the employee has a fingerprint template
        // and simulate a successful match most of the time
        return if (!employee.fingerprintTemplate.isNullOrBlank()) {
            // Simulate 90% success rate for demo
            (0..100).random() > 10
        } else {
            // No fingerprint template enrolled for this employee
            throw Exception("No fingerprint template found for ${employee.name}. Please enroll fingerprint first.")
        }
    }
    
    /**
     * Check if an employee has a fingerprint template enrolled
     */
    fun hasEnrolledFingerprint(employee: Employee): Boolean {
        return !employee.fingerprintTemplate.isNullOrBlank()
    }
    
    /**
     * Enroll a fingerprint for an employee (simulation)
     * In a real app, this would capture and store the fingerprint template
     */
    suspend fun enrollFingerprint(employee: Employee): String {
        // Simulate fingerprint enrollment process
        delay(3000)
        
        // Generate a simulated fingerprint template
        // In reality, this would be biometric data from the sensor
        val timestamp = System.currentTimeMillis()
        return "fp_template_${employee.id}_$timestamp"
    }
}