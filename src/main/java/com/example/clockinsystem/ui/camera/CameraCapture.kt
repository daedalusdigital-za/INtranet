package com.example.clockinsystem.ui.camera

import android.Manifest
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.PermissionStatus
import com.google.accompanist.permissions.rememberPermissionState
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun CameraCapture(
    onImageCaptured: (Bitmap) -> Unit,
    onError: (String) -> Unit,
    onCancel: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    
    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)
    
    // Check permission state
    when (cameraPermissionState.status) {
        is PermissionStatus.Granted -> {
            CameraPreviewScreen(
                context = context,
                lifecycleOwner = lifecycleOwner,
                onImageCaptured = onImageCaptured,
                onError = onError,
                onCancel = onCancel
            )
        }
        is PermissionStatus.Denied -> {
            val shouldShowRationale = (cameraPermissionState.status as PermissionStatus.Denied).shouldShowRationale
            if (shouldShowRationale) {
                PermissionRationaleDialog(
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
                        text = "Camera permission required for face recognition",
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { cameraPermissionState.launchPermissionRequest() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                    ) {
                        Text("Grant Permission", color = Color.Black)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = onCancel,
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
                    ) {
                        Text("Cancel")
                    }
                }
            }
        }
    }
}

@Composable
fun PermissionRationaleDialog(
    onRequestPermission: () -> Unit,
    onCancel: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text("Camera Permission Required") },
        text = { Text("This app needs camera access to capture photos for face recognition. Please grant camera permission to continue.") },
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
fun CameraPreviewScreen(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    onImageCaptured: (Bitmap) -> Unit,
    onError: (String) -> Unit,
    onCancel: () -> Unit
) {
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    
    DisposableEffect(Unit) {
        onDispose {
            cameraExecutor.shutdown()
        }
    }
    
    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                val previewView = PreviewView(ctx)
                startCamera(ctx, lifecycleOwner, previewView) { capture ->
                    imageCapture = capture
                }
                previewView
            }
        )
        
        // Camera controls overlay
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Position your face in the center",
                color = Color.White,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Button(
                    onClick = {
                        imageCapture?.let { capture ->
                            captureImage(capture, cameraExecutor, onImageCaptured, onError)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                ) {
                    Text("Capture Photo", color = Color.Black)
                }
                
                Button(
                    onClick = onCancel,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Red)
                ) {
                    Text("Cancel")
                }
            }
        }
    }
}

private fun startCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    onImageCaptureReady: (ImageCapture) -> Unit
) {
    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    
    cameraProviderFuture.addListener({
        val cameraProvider = cameraProviderFuture.get()
        
        val preview = Preview.Builder()
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }
        
        val imageCapture = ImageCapture.Builder()
            .build()
        
        val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
        
        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                lifecycleOwner, cameraSelector, preview, imageCapture
            )
            onImageCaptureReady(imageCapture)
        } catch (exc: Exception) {
            // Handle error
        }
    }, ContextCompat.getMainExecutor(context))
}

private fun captureImage(
    imageCapture: ImageCapture,
    executor: ExecutorService,
    onImageCaptured: (Bitmap) -> Unit,
    onError: (String) -> Unit
) {
    val outputFileOptions = ImageCapture.OutputFileOptions.Builder(
        java.io.File.createTempFile("temp_photo", ".jpg")
    ).build()
    
    imageCapture.takePicture(
        outputFileOptions,
        executor,
        object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                try {
                    val bitmap = android.graphics.BitmapFactory.decodeFile(output.savedUri?.path)
                    onImageCaptured(bitmap)
                } catch (e: Exception) {
                    onError("Failed to process captured image: ${e.message}")
                }
            }
            
            override fun onError(exception: ImageCaptureException) {
                onError("Image capture failed: ${exception.message}")
            }
        }
    )
}