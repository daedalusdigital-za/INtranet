package com.example.clockinsystem.service

import android.content.Context
import android.util.Log
import com.example.clockinsystem.auth.EnhancedFaceRecognitionManager
import com.example.clockinsystem.data.AppDatabase
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.FaceEmbedding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Service to handle face registration and recognition pipeline
 * Coordinates between face detection, database operations, and recognition
 */
class FaceRegistrationService(private val context: Context) {
    
    companion object {
        private const val TAG = "FaceRegistrationService"
    }
    
    private val database = AppDatabase.getDatabase(context)
    private val faceEmbeddingDao = database.faceEmbeddingDao()
    private val employeeDao = database.employeeDao()
    private val faceRecognitionManager = EnhancedFaceRecognitionManager(context)
    
    /**
     * Register all employees' faces from their saved images
     * This should be called when:
     * 1. New employees are added
     * 2. Employee photos are updated
     * 3. System initialization
     */
    suspend fun registerAllEmployeeFaces(): FaceRegistrationResult = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Starting face registration for all employees")
            
            val employees = employeeDao.getAllEmployees()
            val results = mutableListOf<EmployeeFaceResult>()
            
            for (employee in employees) {
                val result = registerSingleEmployeeFace(employee)
                results.add(result)
                
                if (result.success) {
                    Log.d(TAG, "Successfully registered face for ${employee.name}")
                } else {
                    Log.w(TAG, "Failed to register face for ${employee.name}: ${result.error}")
                }
            }
            
            val successCount = results.count { it.success }
            val totalCount = results.size
            
            Log.d(TAG, "Face registration completed: $successCount/$totalCount successful")
            
            FaceRegistrationResult(
                totalEmployees = totalCount,
                successfulRegistrations = successCount,
                failedRegistrations = totalCount - successCount,
                employeeResults = results
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "Error during face registration: ${e.message}", e)
            FaceRegistrationResult(
                totalEmployees = 0,
                successfulRegistrations = 0,
                failedRegistrations = 0,
                employeeResults = emptyList(),
                overallError = e.message
            )
        }
    }
    
    /**
     * Register a single employee's face
     */
    suspend fun registerSingleEmployeeFace(employee: Employee): EmployeeFaceResult = withContext(Dispatchers.IO) {
        try {
            // Check if employee has a valid image path
            if (employee.referenceImagePath.isEmpty()) {
                return@withContext EmployeeFaceResult(
                    employeeId = employee.id,
                    employeeName = employee.name,
                    success = false,
                    error = "No reference image path provided"
                )
            }
            
            // 1. Process the employee's image and extract face encoding
            val faceEmbedding = faceRecognitionManager.registerEmployeeFace(employee)
            
            if (faceEmbedding == null) {
                return@withContext EmployeeFaceResult(
                    employeeId = employee.id,
                    employeeName = employee.name,
                    success = false,
                    error = "Failed to detect or process face in image"
                )
            }
            
            // 2. Store the face embedding in database
            faceEmbeddingDao.insertFaceEmbedding(faceEmbedding)
            
            Log.d(TAG, "Face encoding stored for ${employee.name}")
            
            EmployeeFaceResult(
                employeeId = employee.id,
                employeeName = employee.name,
                success = true,
                faceEmbedding = faceEmbedding
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "Error registering face for ${employee.name}: ${e.message}", e)
            EmployeeFaceResult(
                employeeId = employee.id,
                employeeName = employee.name,
                success = false,
                error = e.message
            )
        }
    }
    
    /**
     * Get all registered face embeddings
     */
    suspend fun getAllRegisteredFaces(): List<FaceEmbedding> = withContext(Dispatchers.IO) {
        faceEmbeddingDao.getAllFaceEmbeddings()
    }
    
    /**
     * Check how many employees have registered faces
     */
    suspend fun getRegistrationStatus(): RegistrationStatus = withContext(Dispatchers.IO) {
        val totalEmployees = employeeDao.getAllEmployees().size
        val registeredFaces = faceEmbeddingDao.getRegisteredFaceCount()
        
        RegistrationStatus(
            totalEmployees = totalEmployees,
            registeredFaces = registeredFaces,
            pendingRegistrations = totalEmployees - registeredFaces
        )
    }
    
    /**
     * Re-register face for a specific employee
     * Useful when employee photo is updated
     */
    suspend fun reregisterEmployeeFace(employeeId: String): EmployeeFaceResult = withContext(Dispatchers.IO) {
        try {
            // Delete existing face embedding
            faceEmbeddingDao.deleteFaceEmbeddingByEmployeeId(employeeId)
            
            // Get employee data
            val employee = employeeDao.getEmployeeById(employeeId)
                ?: return@withContext EmployeeFaceResult(
                    employeeId = employeeId,
                    employeeName = "Unknown",
                    success = false,
                    error = "Employee not found"
                )
            
            // Register new face
            registerSingleEmployeeFace(employee)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error re-registering face for employee $employeeId: ${e.message}", e)
            EmployeeFaceResult(
                employeeId = employeeId,
                employeeName = "Unknown",
                success = false,
                error = e.message
            )
        }
    }
}

/**
 * Result of face registration process
 */
data class FaceRegistrationResult(
    val totalEmployees: Int,
    val successfulRegistrations: Int,
    val failedRegistrations: Int,
    val employeeResults: List<EmployeeFaceResult>,
    val overallError: String? = null
)

/**
 * Result for individual employee face registration
 */
data class EmployeeFaceResult(
    val employeeId: String,
    val employeeName: String,
    val success: Boolean,
    val error: String? = null,
    val faceEmbedding: FaceEmbedding? = null
)

/**
 * Registration status overview
 */
data class RegistrationStatus(
    val totalEmployees: Int,
    val registeredFaces: Int,
    val pendingRegistrations: Int
) {
    val registrationPercentage: Float
        get() = if (totalEmployees > 0) (registeredFaces.toFloat() / totalEmployees) * 100f else 0f
}