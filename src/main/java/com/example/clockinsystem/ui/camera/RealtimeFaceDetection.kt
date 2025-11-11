package com.example.clockinsystem.ui.camera

import android.Manifest
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.PermissionStatus
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import java.util.concurrent.Executors

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun RealtimeFaceDetection(
    onFaceDetected: (List<Face>, Bitmap) -> Unit,
    onNoFaceDetected: () -> Unit,
    onError: (String) -> Unit,
    onCancel: () -> Unit,
    showFaceOutline: Boolean = true
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    
    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)
    
    var detectedFaces by remember { mutableStateOf<List<Face>>(emptyList()) }
    var previewSize by remember { mutableStateOf(Size(0, 0)) }
    
    when (cameraPermissionState.status) {
        is PermissionStatus.Granted -> {
            RealtimeFaceDetectionScreen(
                context = context,
                lifecycleOwner = lifecycleOwner,
                onFaceDetected = { faces, bitmap ->
                    detectedFaces = faces
                    onFaceDetected(faces, bitmap)
                },
                onNoFaceDetected = {
                    detectedFaces = emptyList()
                    onNoFaceDetected()
                },
                onError = onError,
                onCancel = onCancel,
                onPreviewSizeChanged = { size -> previewSize = size }
            )
        }
        is PermissionStatus.Denied -> {
            val shouldShowRationale = (cameraPermissionState.status as PermissionStatus.Denied).shouldShowRationale
            if (shouldShowRationale) {
                CameraPermissionDialog(
                    onRequestPermission = { cameraPermissionState.launchPermissionRequest() },
                    onCancel = onCancel
                )
            } else {
                LaunchedEffect(Unit) {
                    cameraPermissionState.launchPermissionRequest()
                }
                
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = "Camera permission required for face detection",
                        color = androidx.compose.ui.graphics.Color.White
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { cameraPermissionState.launchPermissionRequest() },
                        colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color.White)
                    ) {
                        Text("Grant Permission", color = androidx.compose.ui.graphics.Color.Black)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onCancel,
                        colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color.Red)
                    ) {
                        Text("Cancel")
                    }
                }
            }
        }
    }
}

@Composable
fun CameraPermissionDialog(
    onRequestPermission: () -> Unit,
    onCancel: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Camera Permission Required") },
        text = { Text("This app needs camera access for real-time face detection. Please grant camera permission to continue.") },
        confirmButton = {
            TextButton(onClick = onRequestPermission) {
                Text("Grant Permission")
            }
        },
        dismissButton = {
            TextButton(onClick = onCancel) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun RealtimeFaceDetectionScreen(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    onFaceDetected: (List<Face>, Bitmap) -> Unit,
    onNoFaceDetected: () -> Unit,
    onError: (String) -> Unit,
    onCancel: () -> Unit,
    onPreviewSizeChanged: (Size) -> Unit
) {
    val executor = remember { Executors.newSingleThreadExecutor() }
    val faceDetector = remember {
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
            .setMinFaceSize(0.1f) // Allow smaller faces to be detected
            .enableTracking()
            .build()
        FaceDetection.getClient(options)
    }
    
    var detectedFaces by remember { mutableStateOf<List<Face>>(emptyList()) }
    
    DisposableEffect(Unit) {
        onDispose {
            executor.shutdown()
            faceDetector.close()
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                startRealtimeCamera(
                    ctx, 
                    lifecycleOwner, 
                    previewView, 
                    faceDetector,
                    onFaceDetected = { faces, bitmap ->
                        detectedFaces = faces
                        onFaceDetected(faces, bitmap)
                    },
                    onNoFaceDetected = {
                        detectedFaces = emptyList()
                        onNoFaceDetected()
                    },
                    onError = onError,
                    onPreviewSizeChanged = onPreviewSizeChanged
                )
                previewView
            }
        )
        
        // Face detection status overlay
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (detectedFaces.isNotEmpty()) 
                        androidx.compose.ui.graphics.Color.Green.copy(alpha = 0.8f) 
                    else 
                        androidx.compose.ui.graphics.Color.Red.copy(alpha = 0.8f)
                )
            ) {
                Text(
                    text = if (detectedFaces.isNotEmpty()) 
                        "Face Detected (${detectedFaces.size})" 
                    else 
                        "No Face Detected",
                    color = androidx.compose.ui.graphics.Color.White,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }
        
        // Control buttons overlay
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Position your face in the center for detection",
                color = androidx.compose.ui.graphics.Color.White,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            
            Button(
                onClick = onCancel,
                colors = ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color.Red)
            ) {
                Text("Cancel")
            }
        }
    }
}

private fun startRealtimeCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    faceDetector: com.google.mlkit.vision.face.FaceDetector,
    onFaceDetected: (List<Face>, Bitmap) -> Unit,
    onNoFaceDetected: () -> Unit,
    onError: (String) -> Unit,
    onPreviewSizeChanged: (Size) -> Unit
) {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    
    cameraProviderFuture.addListener({
        val cameraProvider = cameraProviderFuture.get()
        
        val preview = Preview.Builder()
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }
        
        val imageAnalysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(1280, 720)) // Higher resolution for better detection
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
        
        imageAnalysis.setAnalyzer(ContextCompat.getMainExecutor(context)) { imageProxy ->
            try {
                // Convert imageProxy to bitmap for ML Kit processing
                val bitmap = imageProxyToBitmap(imageProxy)
                val inputImage = InputImage.fromBitmap(bitmap, 0) // Use 0 rotation for now
                
                faceDetector.process(inputImage)
                    .addOnSuccessListener { faces ->
                        println("Face detection result: ${faces.size} faces detected")
                        if (faces.isNotEmpty()) {
                            faces.forEach { face ->
                                println("Face bounds: ${face.boundingBox}, confidence: ${face.smilingProbability}")
                            }
                            onFaceDetected(faces, bitmap)
                        } else {
                            onNoFaceDetected()
                        }
                    }
                    .addOnFailureListener { exception ->
                        println("Face detection error: ${exception.message}")
                        onError("Face detection failed: ${exception.message}")
                    }
                    .addOnCompleteListener {
                        imageProxy.close()
                    }
            } catch (e: Exception) {
                println("Image processing error: ${e.message}")
                e.printStackTrace()
                imageProxy.close()
                onError("Image processing failed: ${e.message}")
            }
        }
        
        val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
        
        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner, 
                cameraSelector, 
                preview, 
                imageAnalysis
            )
            onPreviewSizeChanged(Size(1280, 720))
        } catch (exc: Exception) {
            onError("Camera initialization failed: ${exc.message}")
        }
    }, ContextCompat.getMainExecutor(context))
}

private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap {
    return try {
        val yBuffer = imageProxy.planes[0].buffer
        val uBuffer = imageProxy.planes[1].buffer
        val vBuffer = imageProxy.planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)

        // Copy Y, U, V buffers
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
            80, // Higher quality
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
        println("Bitmap conversion error: ${e.message}")
        e.printStackTrace()
        createFallbackBitmap(imageProxy.width, imageProxy.height)
    }
}

private fun createFallbackBitmap(width: Int, height: Int): Bitmap {
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
        eraseColor(android.graphics.Color.BLACK)
    }
}