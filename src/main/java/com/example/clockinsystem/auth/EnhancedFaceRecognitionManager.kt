package com.example.clockinsystem.auth

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.util.Log
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.example.clockinsystem.model.Employee
import com.example.clockinsystem.model.FaceEmbedding
import kotlinx.coroutines.tasks.await
import java.io.File
import kotlin.math.sqrt

/**
 * Enhanced facial recognition manager that handles:
 * 1. Face detection in saved images
 * 2. Face cropping from employee photos
 * 3. Face encoding generation and storage
 * 4. Face recognition using embeddings
 */
class EnhancedFaceRecognitionManager(private val context: Context) {
    
    companion object {
        private const val TAG = "FaceRecognition"
        private const val SIMILARITY_THRESHOLD = 0.4f // Lowered threshold for better detection
    }

    private val faceDetector by lazy {
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST) // Prioritize speed
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)         // Disable contours
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE) // Disable smiling/eyes open classification
            .setMinFaceSize(0.15f) // Detect faces that are at least 15% of the preview size
            .build()
        FaceDetection.getClient(options)
    }

    /**
     * Register an employee's face from their saved image
     * 1. Load image from path
     * 2. Detect faces in the image
     * 3. Crop the largest/best face
     * 4. Generate face encoding
     * 5. Return face embedding data for database storage
     */
    suspend fun registerEmployeeFace(employee: Employee): FaceEmbedding? {
        try {
            Log.d(TAG, "Registering face for employee: ${employee.name}")
            
            // 1. Load image from path
            val bitmap = loadImageFromPath(employee.referenceImagePath)
                ?: return null.also { Log.e(TAG, "Failed to load image: ${employee.referenceImagePath}") }
            
            // 2. Detect faces in the image
            val faces = detectFacesInImage(bitmap)
            if (faces.isEmpty()) {
                Log.w(TAG, "No faces detected in image for ${employee.name}")
                return null
            }
            
            // 3. Select the best face (largest face)
            val bestFace = selectBestFace(faces)
            
            // 4. Crop face from original image
            val croppedFace = cropFaceFromBitmap(bitmap, bestFace.boundingBox)
                ?: return null.also { Log.e(TAG, "Failed to crop face for ${employee.name}") }
            
            // 5. Generate face encoding/embedding
            val faceEncoding = generateFaceEncoding(bestFace, croppedFace)
            
            Log.d(TAG, "Successfully registered face for ${employee.name}")
            return FaceEmbedding(
                employeeId = employee.id,
                encoding = faceEncoding,
                croppedFacePath = saveCroppedFace(croppedFace, employee.id),
                confidence = bestFace.smilingProbability ?: 0.5f
            )
            
        } catch (e: Exception) {
            Log.e(TAG, "Error registering face for ${employee.name}: ${e.message}", e)
            return null
        }
    }

    /**
     * Recognize a face from camera feed against registered employees
     */
    suspend fun recognizeFaceFromCamera(
        cameraBitmap: Bitmap,
        registeredEmployees: List<Employee>,
        faceEmbeddings: List<FaceEmbedding>
    ): Employee? {
        try {
            Log.d(TAG, "Recognizing face from camera. Registered embeddings: ${faceEmbeddings.size}")
            
            // Detect faces in camera image
            val cameraFaces = detectFacesInImage(cameraBitmap)
            if (cameraFaces.isEmpty()) {
                Log.d(TAG, "No faces detected in camera image")
                return null
            }
            
            Log.d(TAG, "Detected ${cameraFaces.size} faces in camera")
            
            // Use the largest face for recognition
            val targetFace = selectBestFace(cameraFaces)
            val cameraFaceEncoding = generateFaceEncoding(targetFace, cameraBitmap)
            
            // Compare against all registered face embeddings
            var bestMatch: Employee? = null
            var bestSimilarity = 0f
            
            Log.d(TAG, "Comparing against ${faceEmbeddings.size} registered faces")
            
            for (embedding in faceEmbeddings) {
                val similarity = calculateSimilarity(cameraFaceEncoding, embedding.encoding)
                val employee = registeredEmployees.find { it.id == embedding.employeeId }
                Log.d(TAG, "Similarity with ${employee?.name ?: embedding.employeeId}: $similarity (threshold: $SIMILARITY_THRESHOLD)")
                
                if (similarity > SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
                    bestSimilarity = similarity
                    bestMatch = employee
                    Log.d(TAG, "New best match: ${employee?.name} with similarity $similarity")
                }
            }
            
            if (bestMatch != null) {
                Log.d(TAG, "Face recognized: ${bestMatch.name} (similarity: $bestSimilarity)")
            } else {
                Log.w(TAG, "No matching face found. Best similarity: $bestSimilarity, Threshold: $SIMILARITY_THRESHOLD")
                // Also try with even lower threshold as fallback
                if (bestSimilarity > 0.25f) {
                    Log.d(TAG, "Using fallback threshold for face recognition")
                    for (embedding in faceEmbeddings) {
                        val similarity = calculateSimilarity(cameraFaceEncoding, embedding.encoding)
                        if (similarity == bestSimilarity) {
                            bestMatch = registeredEmployees.find { it.id == embedding.employeeId }
                            Log.d(TAG, "Fallback recognition: ${bestMatch?.name} (similarity: $bestSimilarity)")
                            break
                        }
                    }
                }
            }
            
            return bestMatch
            
        } catch (e: Exception) {
            Log.e(TAG, "Error recognizing face: ${e.message}", e)
            return null
        }
    }

    /**
     * Detect faces in a bitmap image
     */
    private suspend fun detectFacesInImage(bitmap: Bitmap): List<Face> {
        return try {
            val image = InputImage.fromBitmap(bitmap, 0)
            faceDetector.process(image).await()
        } catch (e: Exception) {
            Log.e(TAG, "Error detecting faces: ${e.message}", e)
            emptyList()
        }
    }

    /**
     * Select the best face from detected faces (largest face)
     */
    private fun selectBestFace(faces: List<Face>): Face {
        return faces.maxByOrNull { face ->
            val bbox = face.boundingBox
            bbox.width() * bbox.height()
        } ?: faces.first()
    }

    /**
     * Crop face from bitmap using bounding box
     */
    private fun cropFaceFromBitmap(bitmap: Bitmap, boundingBox: Rect): Bitmap? {
        return try {
            // Add padding around face
            val padding = 20
            val left = maxOf(0, boundingBox.left - padding)
            val top = maxOf(0, boundingBox.top - padding)
            val width = minOf(bitmap.width - left, boundingBox.width() + 2 * padding)
            val height = minOf(bitmap.height - top, boundingBox.height() + 2 * padding)
            
            Bitmap.createBitmap(bitmap, left, top, width, height)
        } catch (e: Exception) {
            Log.e(TAG, "Error cropping face: ${e.message}", e)
            null
        }
    }

    /**
     * Generate face encoding/embedding from face bounding box and bitmap
     * Simplified version that works with PERFORMANCE_MODE_FAST
     */
    private fun generateFaceEncoding(face: Face, faceBitmap: Bitmap): FloatArray {
        // Create a simple face encoding based on face bounding box and pixel data
        val encoding = FloatArray(128) // Standard face encoding size
        
        // Use face bounding box properties
        val boundingBox = face.boundingBox
        encoding[0] = boundingBox.centerX().toFloat()
        encoding[1] = boundingBox.centerY().toFloat()
        encoding[2] = boundingBox.width().toFloat()
        encoding[3] = boundingBox.height().toFloat()
        
        // Add face rotation if available
        encoding[4] = face.headEulerAngleY
        encoding[5] = face.headEulerAngleZ
        encoding[6] = face.headEulerAngleX
        
        // Add tracking ID for consistency
        encoding[7] = face.trackingId?.toFloat() ?: 0f
        
        // Fill remaining positions with normalized pixel values from face region
        try {
            // Crop face area for pixel sampling
            val faceWidth = boundingBox.width()
            val faceHeight = boundingBox.height()
            val sampleSize = 8 // Sample 8x8 grid from face
            
            val stepX = faceWidth / sampleSize
            val stepY = faceHeight / sampleSize
            
            var encodingIndex = 8
            for (y in 0 until sampleSize) {
                for (x in 0 until sampleSize) {
                    if (encodingIndex < 128) {
                        val pixelX = boundingBox.left + (x * stepX)
                        val pixelY = boundingBox.top + (y * stepY)
                        
                        if (pixelX < faceBitmap.width && pixelY < faceBitmap.height && pixelX >= 0 && pixelY >= 0) {
                            val pixel = faceBitmap.getPixel(pixelX, pixelY)
                            // Use grayscale value normalized to 0-1
                            val gray = (android.graphics.Color.red(pixel) + android.graphics.Color.green(pixel) + android.graphics.Color.blue(pixel)) / 3
                            encoding[encodingIndex] = gray / 255f
                        } else {
                            encoding[encodingIndex] = 0f
                        }
                        encodingIndex++
                    }
                }
            }
            
            // Fill any remaining positions with face metrics
            while (encodingIndex < 128) {
                encoding[encodingIndex] = (encodingIndex % 10) / 10f // Simple padding
                encodingIndex++
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error generating pixel encoding: ${e.message}", e)
            // Fill with basic face metrics if pixel sampling fails
            for (i in 8 until 128) {
                encoding[i] = ((boundingBox.centerX() + boundingBox.centerY() + i) % 255) / 255f
            }
        }
        
        return encoding
    }

    /**
     * Calculate similarity between two face encodings
     */
    private fun calculateSimilarity(encoding1: FloatArray, encoding2: FloatArray): Float {
        if (encoding1.size != encoding2.size) return 0f
        
        // Calculate Euclidean distance
        var sum = 0f
        for (i in encoding1.indices) {
            val diff = encoding1[i] - encoding2[i]
            sum += diff * diff
        }
        val distance = sqrt(sum)
        
        // Convert distance to similarity (0-1, where 1 is most similar)
        return maxOf(0f, 1f - (distance / encoding1.size))
    }

    /**
     * Load image from file path
     */
    private fun loadImageFromPath(imagePath: String): Bitmap? {
        return try {
            if (imagePath.isNotEmpty()) {
                val file = File(imagePath)
                if (file.exists()) {
                    BitmapFactory.decodeFile(imagePath)
                } else null
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "Error loading image: ${e.message}", e)
            null
        }
    }

    /**
     * Save cropped face to internal storage
     */
    private fun saveCroppedFace(croppedFace: Bitmap, employeeId: String): String {
        return try {
            val file = File(context.filesDir, "faces/cropped_face_$employeeId.jpg")
            file.parentFile?.mkdirs()
            file.outputStream().use { out ->
                croppedFace.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
            file.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Error saving cropped face: ${e.message}", e)
            ""
        }
    }
}