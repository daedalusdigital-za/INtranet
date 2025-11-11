package com.example.clockinsystem.auth

import android.content.Context
import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import kotlin.math.pow
import kotlin.math.sqrt

class FacialRecognitionManager(private val context: Context) {

    private val faceDetector by lazy {
        val options = FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .build()
        FaceDetection.getClient(options)
    }

    fun recognizeFace(
        cameraBitmap: Bitmap,
        referenceImage: Bitmap,
        isClockIn: Boolean,
        onSuccess: (isClockIn: Boolean) -> Unit,
        onFailure: () -> Unit
    ) {
        val cameraImage = InputImage.fromBitmap(cameraBitmap, 0)
        val referenceInputImage = InputImage.fromBitmap(referenceImage, 0)

        faceDetector.process(cameraImage)
            .addOnSuccessListener { cameraFaces ->
                if (cameraFaces.isNotEmpty()) {
                    faceDetector.process(referenceInputImage)
                        .addOnSuccessListener { referenceFaces ->
                            if (referenceFaces.isNotEmpty()) {
                                // Compare the first detected face from the camera with the first from the reference image.
                                if (areFacesSimilar(cameraFaces[0], referenceFaces[0])) {
                                    onSuccess(isClockIn)
                                } else {
                                    onFailure()
                                }
                            } else {
                                onFailure()
                            }
                        }
                        .addOnFailureListener {
                            onFailure()
                        }
                } else {
                    onFailure()
                }
            }
            .addOnFailureListener {
                onFailure()
            }
    }

    private fun areFacesSimilar(face1: Face, face2: Face): Boolean {
        // This is a simplified comparison. A real-world app would use a more robust algorithm.
        // We'll compare the distance between the eyes as a simple metric.
        val face1LeftEye = face1.getLandmark(FaceLandmark.LEFT_EYE)?.position
        val face1RightEye = face1.getLandmark(FaceLandmark.RIGHT_EYE)?.position
        val face2LeftEye = face2.getLandmark(FaceLandmark.LEFT_EYE)?.position
        val face2RightEye = face2.getLandmark(FaceLandmark.RIGHT_EYE)?.position

        if (face1LeftEye != null && face1RightEye != null && face2LeftEye != null && face2RightEye != null) {
            val distance1 = getDistance(face1LeftEye, face1RightEye)
            val distance2 = getDistance(face2LeftEye, face2RightEye)

            // Check if the distances are within a certain tolerance
            return (distance1 - distance2).pow(2) < 2500 // Tolerance of 50 pixels
        }
        return false
    }

    private fun getDistance(p1: android.graphics.PointF, p2: android.graphics.PointF): Float {
        return sqrt((p1.x - p2.x).pow(2) + (p1.y - p2.y).pow(2))
    }
}