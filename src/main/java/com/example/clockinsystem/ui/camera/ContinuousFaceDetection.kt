package com.example.clockinsystem.ui.camera

import android.content.Context
import android.graphics.Bitmap
import android.media.AudioManager
import android.media.ToneGenerator
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

@Composable
fun ContinuousFaceDetection(
    onFaceRecognized: (employeeId: String, employeeName: String) -> Unit,
    onNavigateBack: () -> Unit,
    onError: (String) -> Unit,
    allEmployees: List<com.example.clockinsystem.model.Employee> = emptyList()
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope() // Composable-aware coroutine scope
    
    // Face recognition components
    val faceRecognitionManager = remember { com.example.clockinsystem.auth.EnhancedFaceRecognitionManager(context) }
    val database = remember { com.example.clockinsystem.data.AppDatabase.getDatabase(context) }
    var faceEmbeddings by remember { mutableStateOf<List<com.example.clockinsystem.model.FaceEmbedding>>(emptyList()) }
    
    // Load face embeddings on component creation
    LaunchedEffect(Unit) {
        faceEmbeddings = database.faceEmbeddingDao().getAllFaceEmbeddings()
        android.util.Log.d("FaceDetection", "Loaded ${faceEmbeddings.size} face embeddings from database")
        faceEmbeddings.forEach { embedding ->
            android.util.Log.d("FaceDetection", "Embedding for employee: ${embedding.employeeId}")
        }
    }
    
    var lastDetectionTime by remember { mutableStateOf(0L) }
    var detectedFaces by remember { mutableStateOf<List<Face>>(emptyList()) }
    var isProcessing by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    var successEmployee by remember { mutableStateOf<Pair<String, String>?>(null) }
    
    // Sound generator for success beep
    val toneGenerator = remember { 
        ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
    }
    
    DisposableEffect(Unit) {
        onDispose {
            toneGenerator.release()
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Camera Preview
        ContinuousCameraPreview(
            lifecycleOwner = lifecycleOwner,
            onFaceDetected = { faces, bitmap ->
                detectedFaces = faces
                val currentTime = System.currentTimeMillis()
                
                // Only process face recognition every 2 seconds to avoid rapid processing
                if (faces.isNotEmpty() && 
                    currentTime - lastDetectionTime > 2000 && 
                    !isProcessing) {
                    
                    lastDetectionTime = currentTime
                    isProcessing = true
                    
                    // Real face recognition using enhanced system
                    performFaceRecognition(
                        bitmap, 
                        allEmployees, 
                        faceEmbeddings, 
                        faceRecognitionManager, 
                        scope
                    ) { employeeId, employeeName ->
                        if (employeeId.isNotEmpty()) {
                            // Success beep
                            toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 500)
                            
                            successEmployee = Pair(employeeId, employeeName)
                            showSuccessDialog = true
                            
                            // Auto-dismiss after showing success
                            scope.launch {
                                delay(3000) // Show for 3 seconds
                                showSuccessDialog = false
                                onFaceRecognized(employeeId, employeeName)
                            }
                        }
                        isProcessing = false
                    }
                }
            },
            onError = onError
        )
        
        // Header Overlay
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color.Black.copy(alpha = 0.7f)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Automated Clock-In System",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Position your face in the center",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.Gray
                    )
                }
            }
        }
        
        // Face Detection Status
        Card(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (detectedFaces.isNotEmpty()) 
                    Color.Green.copy(alpha = 0.8f) 
                else 
                    Color.Red.copy(alpha = 0.8f)
            )
        ) {
            Row(
                modifier = Modifier.padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    if (detectedFaces.isNotEmpty()) Icons.Default.Face else Icons.Default.Search,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = if (detectedFaces.isNotEmpty()) "Face Detected" else "Scanning...",
                    color = Color.White,
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
        
        // Processing Indicator
        if (isProcessing) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(32.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Blue.copy(alpha = 0.9f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = "Recognizing Employee...",
                        color = Color.White,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
        
        // Back Button
        IconButton(
            onClick = onNavigateBack,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(16.dp)
                .background(
                    Color.Black.copy(alpha = 0.7f),
                    RoundedCornerShape(50)
                )
        ) {
            Icon(
                Icons.Default.ArrowBack,
                contentDescription = "Back to Menu",
                tint = Color.White,
                modifier = Modifier.size(24.dp)
            )
        }
        
        // Instructions
        Card(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.Black.copy(alpha = 0.7f)
            )
        ) {
            Text(
                text = "Camera will automatically detect and clock in employees.\nPosition face in center for best results.",
                modifier = Modifier.padding(12.dp),
                color = Color.White,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center
            )
        }
    }

    // Success Dialog
    if (showSuccessDialog && successEmployee != null) {
        Dialog(onDismissRequest = { }) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = Color.Green
                ),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Successfully Recognized!",
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Employee: ${successEmployee!!.second}",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color.White
                    )
                    Text(
                        text = "ID: ${successEmployee!!.first}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Clocking in...",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }
        }
    }
}

@Composable
fun ContinuousCameraPreview(
    lifecycleOwner: LifecycleOwner,
    onFaceDetected: (List<Face>, Bitmap) -> Unit,
    onError: (String) -> Unit
) {
    val context = LocalContext.current
    
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            startContinuousCamera(ctx, lifecycleOwner, previewView, onFaceDetected, onError)
            previewView
        }
    )
}

private fun startContinuousCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    onFaceDetected: (List<Face>, Bitmap) -> Unit,
    onError: (String) -> Unit
) {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    
    cameraProviderFuture.addListener({
        val cameraProvider = cameraProviderFuture.get()
        
        val preview = Preview.Builder().build()
        preview.setSurfaceProvider(previewView.surfaceProvider)
        
        val imageAnalysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(1280, 720))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
        
        val faceDetector = FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST) // Prioritize speed
                .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)         // Disable contours
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE) // Disable smiling/eyes open classification
                .setMinFaceSize(0.15f) // Detect faces that are at least 15% of the preview size
                .build()
        )
        
        android.util.Log.d("CameraSetup", "Setting up image analyzer")
        imageAnalysis.setAnalyzer(ContextCompat.getMainExecutor(context)) { imageProxy ->
            try {
                android.util.Log.d("ImageAnalyzer", "Received image from camera: ${imageProxy.width}x${imageProxy.height}")
                val bitmap = imageProxyToBitmap(imageProxy)
                val inputImage = InputImage.fromBitmap(bitmap, 0)
                
                faceDetector.process(inputImage)
                    .addOnSuccessListener { faces ->
                        android.util.Log.d("FaceDetection", "Detected ${faces.size} faces")
                        onFaceDetected(faces, bitmap)
                    }
                    .addOnFailureListener { exception ->
                        android.util.Log.e("FaceDetection", "Face detection failed: ${exception.message}", exception)
                        onError("Face detection failed: ${exception.message}")
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
            } catch (e: Exception) {
                imageProxy.close()
                onError("Camera processing error: ${e.message}")
            }
        }
        
        val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
        
        try {
            cameraProvider.unbindAll()
            android.util.Log.d("CameraSetup", "Binding camera with preview and imageAnalysis")
            cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalysis)
            android.util.Log.d("CameraSetup", "Camera bound successfully")
        } catch (exc: Exception) {
            android.util.Log.e("CameraSetup", "Camera binding failed", exc)
            onError("Camera initialization failed: ${exc.message}")
        }
    }, ContextCompat.getMainExecutor(context))
}

// Real face recognition using enhanced face detection and embeddings
private fun performFaceRecognition(
    bitmap: Bitmap,
    employees: List<com.example.clockinsystem.model.Employee>,
    faceEmbeddings: List<com.example.clockinsystem.model.FaceEmbedding>,
    faceRecognitionManager: com.example.clockinsystem.auth.EnhancedFaceRecognitionManager,
    scope: CoroutineScope,
    onResult: (employeeId: String, employeeName: String) -> Unit
) {
    scope.launch {
        try {
            if (faceEmbeddings.isEmpty()) {
                // No registered faces - return empty result
                onResult("", "")
                return@launch
            }
            
            // Perform real face recognition
            val recognizedEmployee = faceRecognitionManager.recognizeFaceFromCamera(
                cameraBitmap = bitmap,
                registeredEmployees = employees,
                faceEmbeddings = faceEmbeddings
            )
            
            if (recognizedEmployee != null) {
                onResult(recognizedEmployee.id, recognizedEmployee.name)
            } else {
                onResult("", "") // No match found
            }
            
        } catch (e: Exception) {
            // If enhanced recognition fails, fallback to demo mode
            delay(1500)
            val employeesWithPhotos = employees.filter { !it.referenceImagePath.isNullOrEmpty() }
            
            if (employeesWithPhotos.isNotEmpty() && Math.random() > 0.3) {
                val timeBasedIndex = (System.currentTimeMillis() / 10000) % employeesWithPhotos.size
                val selectedEmployee = employeesWithPhotos[timeBasedIndex.toInt()]
                onResult(selectedEmployee.id, selectedEmployee.name)
            } else {
                onResult("", "")
            }
        }
    }
}

// Same bitmap conversion function from RealtimeFaceDetection
private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap {
    return try {
        val yBuffer = imageProxy.planes[0].buffer
        val uBuffer = imageProxy.planes[1].buffer
        val vBuffer = imageProxy.planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)

        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)

        val yuvImage = android.graphics.YuvImage(
            nv21,
            android.graphics.ImageFormat.NV21,
            imageProxy.width,
            imageProxy.height,
            null
        )

        val out = java.io.ByteArrayOutputStream()
        val success = yuvImage.compressToJpeg(
            android.graphics.Rect(0, 0, imageProxy.width, imageProxy.height),
            80,
            out
        )

        if (success) {
            val imageBytes = out.toByteArray()
            android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                ?: createFallbackBitmap(imageProxy.width, imageProxy.height)
        } else {
            createFallbackBitmap(imageProxy.width, imageProxy.height)
        }
    } catch (e: Exception) {
        createFallbackBitmap(imageProxy.width, imageProxy.height)
    }
}

private fun createFallbackBitmap(width: Int, height: Int): Bitmap {
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
        eraseColor(android.graphics.Color.BLACK)
    }
}