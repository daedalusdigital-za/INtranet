package com.example.clockinsystem.ui

import android.graphics.*
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.fragment.app.FragmentActivity
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.launch
import java.io.FileOutputStream
import java.io.File

/**
 * Enhanced image picker and face detection for employee photo registration
 * Uses optimal settings for static image analysis
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImageFaceDetectionScreen(
    onNavigateBack: () -> Unit,
    onFaceDetected: (imagePath: String, faceCount: Int, faceInfo: String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var selectedImageUri by remember { mutableStateOf<Uri?>(null) }
    var selectedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var processedBitmap by remember { mutableStateOf<Bitmap?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var detectionResult by remember { mutableStateOf<String?>(null) }
    var faceCount by remember { mutableStateOf(0) }
    var showDetailDialog by remember { mutableStateOf(false) }
    var faceDetails by remember { mutableStateOf<List<Face>>(emptyList()) }
    
    // Modern image picker launcher
    val pickImageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedImageUri = it
            scope.launch {
                loadImageFromUri(context, it) { bitmap ->
                    selectedBitmap = bitmap
                    detectionResult = null
                    processedBitmap = null
                    faceCount = 0
                }
            }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Image Face Detection") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Blue
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Instructions
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.Blue.copy(alpha = 0.1f))
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Upload Image for Face Detection",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("1. Select a high-quality image with clear faces")
                    Text("2. The system will analyze the image for faces")
                    Text("3. Results show face count and quality metrics")
                    Text("4. Use for employee photo registration")
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Image selection button
            Button(
                onClick = { pickImageLauncher.launch("image/*") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Green)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Select Image from Gallery", style = MaterialTheme.typography.titleMedium)
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Display selected image
            selectedBitmap?.let { bitmap ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(300.dp)
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        Image(
                            bitmap = (processedBitmap ?: bitmap).asImageBitmap(),
                            contentDescription = "Selected Image",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                        
                        // Processing overlay
                        if (isProcessing) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.7f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    CircularProgressIndicator(color = Color.White)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("Analyzing faces...", color = Color.White)
                                }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Analyze button
                Button(
                    onClick = {
                        scope.launch {
                            detectFacesInBitmap(context, bitmap) { faces, annotatedBitmap, result ->
                                faceDetails = faces
                                processedBitmap = annotatedBitmap
                                detectionResult = result
                                faceCount = faces.size
                                isProcessing = false
                            }
                        }
                        isProcessing = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isProcessing,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Blue)
                ) {
                    Icon(Icons.Default.Search, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Analyze Faces in Image")
                }
            }
            
            // Results
            detectionResult?.let { result ->
                Spacer(modifier = Modifier.height(16.dp))
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (faceCount > 0) Color.Green.copy(alpha = 0.1f) else Color.Red.copy(alpha = 0.1f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Detection Results",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(result)
                        
                        if (faceCount > 0) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = { showDetailDialog = true },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("View Face Details")
                            }
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            Button(
                                onClick = {
                                    selectedImageUri?.let { uri ->
                                        scope.launch {
                                            val imagePath = saveImageToInternalStorage(context, selectedBitmap!!)
                                            if (imagePath != null) {
                                                onFaceDetected(imagePath, faceCount, result)
                                            }
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color.Green)
                            ) {
                                Text("Use This Image for Registration")
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Face details dialog
    if (showDetailDialog) {
        Dialog(onDismissRequest = { showDetailDialog = false }) {
            Card(modifier = Modifier.padding(16.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Face Analysis Details",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    faceDetails.forEachIndexed { index, face ->
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.Blue.copy(alpha = 0.1f))
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text("Face ${index + 1}:", fontWeight = FontWeight.Bold)
                                Text("Size: ${face.boundingBox.width()} x ${face.boundingBox.height()}")
                                Text("Position: (${face.boundingBox.centerX()}, ${face.boundingBox.centerY()})")
                                face.smilingProbability?.let { 
                                    Text("Smiling: ${(it * 100).toInt()}%")
                                }
                                face.leftEyeOpenProbability?.let { 
                                    Text("Left Eye Open: ${(it * 100).toInt()}%")
                                }
                                face.rightEyeOpenProbability?.let { 
                                    Text("Right Eye Open: ${(it * 100).toInt()}%")
                                }
                            }
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { showDetailDialog = false },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Close")
                    }
                }
            }
        }
    }
}

// Helper function to load image from URI
private suspend fun loadImageFromUri(
    context: android.content.Context,
    uri: Uri,
    onImageLoaded: (Bitmap?) -> Unit
) {
    try {
        val inputStream = context.contentResolver.openInputStream(uri)
        val bitmap = BitmapFactory.decodeStream(inputStream)
        inputStream?.close()
        onImageLoaded(bitmap)
    } catch (e: Exception) {
        e.printStackTrace()
        onImageLoaded(null)
    }
}

// Face detection function optimized for static images
private suspend fun detectFacesInBitmap(
    context: android.content.Context,
    bitmap: Bitmap,
    onResult: (faces: List<Face>, annotatedBitmap: Bitmap, result: String) -> Unit
) {
    try {
        // Create InputImage from bitmap
        val image = InputImage.fromBitmap(bitmap, 0)
        
        // Configure detector for ACCURACY on static images
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE) // Use ACCURATE for static images
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL) // Get detailed facial contours
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL) // Check for smile, eyes open
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL) // Get all facial landmarks
            .setMinFaceSize(0.1f) // Detect smaller faces in static images
            .build()
        
        val detector = FaceDetection.getClient(options)
        
        // Process the image
        detector.process(image)
            .addOnSuccessListener { faces ->
                val result = if (faces.isEmpty()) {
                    "❌ No faces detected in the uploaded image.\n\nTips:\n• Ensure good lighting\n• Face should be clearly visible\n• Try a different angle"
                } else {
                    val faceInfo = StringBuilder()
                    faceInfo.append("✅ ${faces.size} face(s) detected!\n\n")
                    
                    faces.forEachIndexed { index, face ->
                        faceInfo.append("Face ${index + 1}:\n")
                        faceInfo.append("• Size: ${face.boundingBox.width()} x ${face.boundingBox.height()}\n")
                        
                        face.smilingProbability?.let { smile ->
                            faceInfo.append("• Smiling: ${(smile * 100).toInt()}%\n")
                        }
                        
                        face.leftEyeOpenProbability?.let { leftEye ->
                            face.rightEyeOpenProbability?.let { rightEye ->
                                faceInfo.append("• Eyes Open: L:${(leftEye * 100).toInt()}% R:${(rightEye * 100).toInt()}%\n")
                            }
                        }
                        
                        faceInfo.append("• Head Angle: Y:${face.headEulerAngleY.toInt()}° Z:${face.headEulerAngleZ.toInt()}°\n\n")
                    }
                    
                    faceInfo.toString()
                }
                
                // Create annotated bitmap with face bounds
                val annotatedBitmap = drawFaceBoundsOnBitmap(bitmap, faces)
                onResult(faces, annotatedBitmap, result)
            }
            .addOnFailureListener { e ->
                onResult(emptyList(), bitmap, "❌ Face detection failed: ${e.message}")
            }
        
    } catch (e: Exception) {
        onResult(emptyList(), bitmap, "❌ Error processing image: ${e.message}")
    }
}

// Helper function to draw face bounding boxes on bitmap
private fun drawFaceBoundsOnBitmap(originalBitmap: Bitmap, faces: List<Face>): Bitmap {
    val mutableBitmap = originalBitmap.copy(Bitmap.Config.ARGB_8888, true)
    val canvas = Canvas(mutableBitmap)
    
    faces.forEachIndexed { index, face ->
        // Face bounding box
        val paint = Paint().apply {
            color = android.graphics.Color.RED
            style = Paint.Style.STROKE
            strokeWidth = 8.0f
        }
        canvas.drawRect(face.boundingBox, paint)
        
        // Face number label
        val textPaint = Paint().apply {
            color = android.graphics.Color.RED
            textSize = 40f
            style = Paint.Style.FILL
            isAntiAlias = true
        }
        canvas.drawText(
            "Face ${index + 1}",
            face.boundingBox.left.toFloat(),
            face.boundingBox.top.toFloat() - 10f,
            textPaint
        )
        
        // Draw landmarks if available
        face.allLandmarks.forEach { landmark ->
            val landmarkPaint = Paint().apply {
                color = android.graphics.Color.BLUE
                style = Paint.Style.FILL
            }
            canvas.drawCircle(
                landmark.position.x,
                landmark.position.y,
                8f,
                landmarkPaint
            )
        }
    }
    
    return mutableBitmap
}

// Save image to internal storage
private suspend fun saveImageToInternalStorage(context: android.content.Context, bitmap: Bitmap): String? {
    return try {
        val filename = "employee_photo_${System.currentTimeMillis()}.jpg"
        val file = File(context.filesDir, filename)
        val outputStream = FileOutputStream(file)
        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)
        outputStream.flush()
        outputStream.close()
        file.absolutePath
    } catch (e: Exception) {
        e.printStackTrace()
        null
    }
}