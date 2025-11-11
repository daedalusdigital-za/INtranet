package com.example.clockinsystem.ui.camera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.ToneGenerator
import android.media.AudioManager
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Face
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.example.clockinsystem.ml.EnhancedFaceRecognitionManager
import com.example.clockinsystem.model.Employee
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@Composable
fun EnhancedContinuousFaceDetection(
    enhancedFaceRecognition: EnhancedFaceRecognitionManager,
    allEmployees: List<Employee>,
    onFaceRecognized: (Employee, Float) -> Unit,
    onError: (String) -> Unit,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    
    var detectionStatus by remember { mutableStateOf("Initializing camera...") }
    var isProcessing by remember { mutableStateOf(false) }
    var lastDetectionTime by remember { mutableStateOf(0L) }
    var detectedFaceCount by remember { mutableStateOf(0) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    var successEmployee by remember { mutableStateOf<Pair<String, String>?>(null) }
    
    Box(modifier = Modifier.fillMaxSize()) {
        // Enhanced Camera Preview with FaceNet integration
        EnhancedCameraPreview(
            lifecycleOwner = lifecycleOwner,
            onFaceDetected = { faceCount, bitmap ->
                detectedFaceCount = faceCount
                val currentTime = System.currentTimeMillis()
                
                // Update status based on detection
                detectionStatus = when {
                    faceCount == 0 -> "No face detected - please look at the camera"
                    faceCount == 1 -> "Face detected - processing recognition..."
                    else -> "$faceCount faces detected - processing..."
                }
                
                // Process face recognition with cooldown
                if (faceCount > 0 && 
                    currentTime - lastDetectionTime > 3000 && // 3 second cooldown
                    !isProcessing) {
                    
                    isProcessing = true
                    lastDetectionTime = currentTime
                    
                    scope.launch {
                        try {
                            detectionStatus = "Running FaceNet recognition..."
                            
                            // Use FaceNet for recognition
                            val (recognizedEmployee, confidence) = enhancedFaceRecognition.recognizeFaceInImage(
                                bitmap, allEmployees
                            )
                            
                            if (recognizedEmployee != null && confidence > 0.65f) {
                                // Success - play beep and show dialog
                                val toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100)
                                toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 500)
                                toneGenerator.release()
                                
                                successEmployee = Pair(recognizedEmployee.id, recognizedEmployee.name)
                                showSuccessDialog = true
                                detectionStatus = "✓ ${recognizedEmployee.name} recognized!"
                                
                                // Auto-dismiss dialog and proceed
                                delay(3000)
                                showSuccessDialog = false
                                onFaceRecognized(recognizedEmployee, confidence)
                                
                            } else {
                                detectionStatus = "Face not recognized - please try again"
                                delay(2000)
                                detectionStatus = "Ready for face detection..."
                            }
                            
                        } catch (e: Exception) {
                            detectionStatus = "Recognition error: ${e.message}"
                            delay(2000)
                            detectionStatus = "Ready for face detection..."
                        }
                        
                        isProcessing = false
                    }
                }
            },
            onError = onError
        )
        
        // UI Overlay
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onNavigateBack,
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color.Black.copy(alpha = 0.6f)
                    )
                ) {
                    Icon(
                        Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
                
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color.Black.copy(alpha = 0.6f)
                    )
                ) {
                    Text(
                        text = "FaceNet Recognition",
                        color = Color.White,
                        modifier = Modifier.padding(8.dp)
                    )
                }
            }
            
            // Bottom status
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Black.copy(alpha = 0.7f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Default.Face,
                            contentDescription = null,
                            tint = if (detectedFaceCount > 0) Color.Green else Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                        
                        Text(
                            text = "Faces: $detectedFaceCount",
                            color = if (detectedFaceCount > 0) Color.Green else Color.White
                        )
                        
                        if (isProcessing) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.Blue,
                                strokeWidth = 2.dp
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = detectionStatus,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
        
        // Success Dialog
        if (showSuccessDialog && successEmployee != null) {
            Card(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(32.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.Green.copy(alpha = 0.9f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.Face,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = "✓ Recognized!",
                        color = Color.White,
                        style = MaterialTheme.typography.headlineSmall
                    )
                    
                    Text(
                        text = successEmployee!!.second,
                        color = Color.White,
                        style = MaterialTheme.typography.titleMedium
                    )
                    
                    Text(
                        text = "ID: ${successEmployee!!.first}",
                        color = Color.White.copy(alpha = 0.8f),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

@Composable
fun EnhancedCameraPreview(
    lifecycleOwner: LifecycleOwner,
    onFaceDetected: (Int, Bitmap) -> Unit,
    onError: (String) -> Unit
) {
    val context = LocalContext.current
    var previewView: PreviewView? by remember { mutableStateOf(null) }
    
    // Fast face detector for real-time detection
    val faceDetector = remember {
        FaceDetection.getClient(
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
                .setMinFaceSize(0.15f)
                .build()
        )
    }
    
    val cameraExecutor: ExecutorService = remember { Executors.newSingleThreadExecutor() }
    
    AndroidView(
        factory = { ctx ->
            PreviewView(ctx).apply {
                previewView = this
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }
        },
        modifier = Modifier.fillMaxSize()
    ) { view ->
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()
                
                // Preview use case
                val preview = Preview.Builder()
                    .build()
                    .also {
                        it.setSurfaceProvider(view.surfaceProvider)
                    }
                
                // Image analysis use case for face detection
                val imageAnalyzer = ImageAnalysis.Builder()
                    .setTargetRotation(view.display.rotation)
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { analysis ->
                        analysis.setAnalyzer(cameraExecutor, ImageAnalyzer(
                            faceDetector = faceDetector,
                            onFaceDetected = onFaceDetected,
                            onError = onError
                        ))
                    }
                
                // Camera selector
                val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
                
                try {
                    // Unbind use cases before rebinding
                    cameraProvider.unbindAll()
                    
                    // Bind use cases to camera
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        cameraSelector,
                        preview,
                        imageAnalyzer
                    )
                    
                    Log.d("EnhancedCameraPreview", "Camera setup successful")
                    
                } catch (exc: Exception) {
                    Log.e("EnhancedCameraPreview", "Use case binding failed", exc)
                    onError("Camera binding failed: ${exc.message}")
                }
                
            } catch (exc: Exception) {
                Log.e("EnhancedCameraPreview", "Camera initialization failed", exc)
                onError("Camera initialization failed: ${exc.message}")
            }
        }, ContextCompat.getMainExecutor(context))
    }
    
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
        }
    }
}

private class ImageAnalyzer(
    private val faceDetector: com.google.mlkit.vision.face.FaceDetector,
    private val onFaceDetected: (Int, Bitmap) -> Unit,
    private val onError: (String) -> Unit
) : ImageAnalysis.Analyzer {
    
    companion object {
        private const val TAG = "ImageAnalyzer"
    }
    
    @androidx.camera.core.ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        try {
            val mediaImage = imageProxy.image
            if (mediaImage != null) {
                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                
                // Convert to bitmap for face recognition
                val bitmap = imageProxyToBitmap(imageProxy)
                
                faceDetector.process(image)
                    .addOnSuccessListener { faces ->
                        Log.d(TAG, "Face detection successful: ${faces.size} faces detected")
                        if (bitmap != null) {
                            onFaceDetected(faces.size, bitmap)
                        }
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "Face detection failed", e)
                        onError("Face detection failed: ${e.message}")
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
            } else {
                imageProxy.close()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in image analysis", e)
            onError("Image analysis error: ${e.message}")
            imageProxy.close()
        }
    }
    
    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
        return try {
            val yBuffer = imageProxy.planes[0].buffer // Y
            val vuBuffer = imageProxy.planes[2].buffer // VU
            
            val ySize = yBuffer.remaining()
            val vuSize = vuBuffer.remaining()
            
            val nv21 = ByteArray(ySize + vuSize)
            
            yBuffer.get(nv21, 0, ySize)
            vuBuffer.get(nv21, ySize, vuSize)
            
            val yuvImage = YuvImage(nv21, ImageFormat.NV21, imageProxy.width, imageProxy.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, yuvImage.width, yuvImage.height), 50, out)
            val imageBytes = out.toByteArray()
            
            BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
        } catch (e: Exception) {
            Log.e(TAG, "Error converting ImageProxy to Bitmap", e)
            null
        }
    }
}