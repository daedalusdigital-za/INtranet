package com.example.clockinsystem.ml

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.util.Log
import com.example.clockinsystem.data.ClockInRepository
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.FaceEmbedding
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File

class EnhancedFaceRecognitionManager(
    private val context: Context,
    private val repository: ClockInRepository
) {
    
    private val faceNetModel = FaceNetModel(context)
    private var isModelLoaded = false
    
    // Face detection for better face extraction
    private val faceDetector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            .setMinFaceSize(0.1f)
            .build()
    )
    
    // Fast detector for real-time recognition
    private val fastFaceDetector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            .setMinFaceSize(0.15f)
            .build()
    )
    
    companion object {
        private const val TAG = "EnhancedFaceRecognition"
        private const val SIMILARITY_THRESHOLD = 0.65f // FaceNet threshold for mock implementation
        private const val HIGH_CONFIDENCE_THRESHOLD = 0.80f
        private const val MIN_FACE_SIZE = 80 // Minimum face size in pixels
    }
    
    suspend fun initializeModel(): Boolean {
        return withContext(Dispatchers.IO) {
            if (!isModelLoaded) {
                isModelLoaded = faceNetModel.loadModel()
                Log.d(TAG, "FaceNet model initialization: $isModelLoaded")
            }
            isModelLoaded
        }
    }
    
    suspend fun registerEmployeeFace(employee: Employee): Boolean {
        if (!isModelLoaded) {
            Log.w(TAG, "Model not loaded, cannot register face")
            return false
        }
        
        return withContext(Dispatchers.IO) {
            try {
                // Load employee's reference image
                val referenceImage = loadEmployeeImage(employee.referenceImagePath)
                if (referenceImage == null) {
                    Log.w(TAG, "Could not load reference image for ${employee.id}")
                    return@withContext false
                }
                
                // Detect and extract face from reference image
                val faceBitmap = extractBestFace(referenceImage, useAccurate = true)
                if (faceBitmap == null) {
                    Log.w(TAG, "No face detected in reference image for ${employee.id}")
                    return@withContext false
                }
                
                // Generate FaceNet embedding
                val embedding = faceNetModel.generateEmbedding(faceBitmap)
                if (embedding == null || !faceNetModel.isValidEmbedding(embedding)) {
                    Log.w(TAG, "Failed to generate valid embedding for ${employee.id}")
                    return@withContext false
                }
                
                // Save embedding to database using existing FaceEmbedding entity
                val faceEmbedding = FaceEmbedding(
                    employeeId = employee.id,
                    encoding = embedding, // Using existing 'encoding' field
                    croppedFacePath = saveCroppedFace(employee.id, faceBitmap),
                    confidence = 1.0f, // High confidence for registration
                    registrationDate = System.currentTimeMillis()
                )
                
                repository.insertFaceEmbedding(faceEmbedding)
                Log.d(TAG, "Successfully registered face for ${employee.id}")
                true
                
            } catch (e: Exception) {
                Log.e(TAG, "Error registering face for ${employee.id}: ${e.message}")
                false
            }
        }
    }
    
    suspend fun recognizeFaceInImage(capturedBitmap: Bitmap, employees: List<Employee>): Pair<Employee?, Float> {
        if (!isModelLoaded) {
            Log.w(TAG, "Model not loaded, cannot recognize face")
            return Pair(null, 0f)
        }
        
        return withContext(Dispatchers.IO) {
            try {
                // Extract face from captured image using fast detector for real-time
                val faceBitmap = extractBestFace(capturedBitmap, useAccurate = false)
                if (faceBitmap == null) {
                    Log.d(TAG, "No face detected in captured image")
                    return@withContext Pair(null, 0f)
                }
                
                // Generate embedding for captured face
                val capturedEmbedding = faceNetModel.generateEmbedding(faceBitmap)
                if (capturedEmbedding == null || !faceNetModel.isValidEmbedding(capturedEmbedding)) {
                    Log.w(TAG, "Failed to generate embedding for captured face")
                    return@withContext Pair(null, 0f)
                }
                
                // Get all registered face embeddings
                val registeredEmbeddings = repository.getAllFaceEmbeddings()
                if (registeredEmbeddings.isEmpty()) {
                    Log.d(TAG, "No registered face embeddings found")
                    return@withContext Pair(null, 0f)
                }
                
                // Find best match
                var bestMatch: Employee? = null
                var bestSimilarity = 0f
                
                for (embedding in registeredEmbeddings) {
                    val similarity = faceNetModel.calculateSimilarity(capturedEmbedding, embedding.encoding)
                    
                    Log.d(TAG, "Similarity with ${embedding.employeeId}: $similarity")
                    
                    if (similarity > bestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
                        bestSimilarity = similarity
                        bestMatch = employees.find { it.id == embedding.employeeId }
                    }
                }
                
                if (bestMatch != null) {
                    val confidenceLevel = when {
                        bestSimilarity >= HIGH_CONFIDENCE_THRESHOLD -> "High"
                        bestSimilarity >= SIMILARITY_THRESHOLD -> "Medium"
                        else -> "Low"
                    }
                    Log.d(TAG, "Face recognized: ${bestMatch.name} (${String.format("%.3f", bestSimilarity)} - $confidenceLevel confidence)")
                }
                
                Pair(bestMatch, bestSimilarity)
                
            } catch (e: Exception) {
                Log.e(TAG, "Error recognizing face: ${e.message}")
                Pair(null, 0f)
            }
        }
    }
    
    private suspend fun extractBestFace(bitmap: Bitmap, useAccurate: Boolean = true): Bitmap? {
        return try {
            val detector = if (useAccurate) faceDetector else fastFaceDetector
            val image = InputImage.fromBitmap(bitmap, 0)
            val faces = detector.process(image).await()
            
            if (faces.isEmpty()) {
                Log.d(TAG, "No faces detected in image")
                return null
            }
            
            // Find the largest face (assumed to be the main subject)
            val bestFace = faces.maxByOrNull { 
                it.boundingBox.width() * it.boundingBox.height() 
            }
            
            bestFace?.let { face ->
                val boundingBox = face.boundingBox
                
                // Check if face is large enough
                if (boundingBox.width() < MIN_FACE_SIZE || boundingBox.height() < MIN_FACE_SIZE) {
                    Log.d(TAG, "Face too small: ${boundingBox.width()}x${boundingBox.height()}")
                    return null
                }
                
                // Add padding around face
                val padding = (boundingBox.width() * 0.3f).toInt()
                val expandedRect = Rect(
                    maxOf(0, boundingBox.left - padding),
                    maxOf(0, boundingBox.top - padding),
                    minOf(bitmap.width, boundingBox.right + padding),
                    minOf(bitmap.height, boundingBox.bottom + padding)
                )
                
                // Crop the face region
                val croppedFace = Bitmap.createBitmap(
                    bitmap,
                    expandedRect.left,
                    expandedRect.top,
                    expandedRect.width(),
                    expandedRect.height()
                )
                
                Log.d(TAG, "Extracted face: ${expandedRect.width()}x${expandedRect.height()}")
                croppedFace
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error extracting face: ${e.message}")
            null
        }
    }
    
    private fun loadEmployeeImage(imagePath: String?): Bitmap? {
        if (imagePath.isNullOrEmpty()) return null
        
        return try {
            val file = File(imagePath)
            if (file.exists()) {
                BitmapFactory.decodeFile(file.absolutePath)
            } else {
                Log.w(TAG, "Image file not found: $imagePath")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading image: ${e.message}")
            null
        }
    }
    
    private fun saveCroppedFace(employeeId: String, faceBitmap: Bitmap): String {
        return try {
            val file = File(context.filesDir, "${employeeId}_cropped_face.jpg")
            file.outputStream().use { out ->
                faceBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
            file.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Error saving cropped face: ${e.message}")
            ""
        }
    }
    
    suspend fun getDiagnosticInfo(): Map<String, Any> {
        return withContext(Dispatchers.IO) {
            val embeddings = repository.getAllFaceEmbeddings()
            val employees = repository.getAllEmployees()
            val modelInfo = faceNetModel.getModelInfo()
            
            mapOf(
                "modelLoaded" to isModelLoaded,
                "totalEmployees" to employees.size,
                "registeredFaces" to embeddings.size,
                "employeesWithPhotos" to employees.count { !it.referenceImagePath.isNullOrEmpty() },
                "threshold" to SIMILARITY_THRESHOLD,
                "highConfidenceThreshold" to HIGH_CONFIDENCE_THRESHOLD,
                "faceNetInfo" to modelInfo
            )
        }
    }
    
    suspend fun reprocessAllEmployeeFaces(): Int {
        return withContext(Dispatchers.IO) {
            val employees = repository.getAllEmployees()
            var processedCount = 0
            
            for (employee in employees) {
                if (!employee.referenceImagePath.isNullOrEmpty()) {
                    try {
                        // Delete existing embedding
                        repository.deleteFaceEmbeddingByEmployeeId(employee.id)
                        
                        // Re-register face
                        if (registerEmployeeFace(employee)) {
                            processedCount++
                            Log.d(TAG, "Reprocessed face for ${employee.id}")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error reprocessing face for ${employee.id}: ${e.message}")
                    }
                }
            }
            
            Log.d(TAG, "Reprocessed $processedCount face embeddings")
            processedCount
        }
    }
    
    fun cleanup() {
        faceNetModel.close()
        isModelLoaded = false
    }
}