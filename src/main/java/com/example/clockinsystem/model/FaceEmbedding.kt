package com.example.clockinsystem.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters

/**
 * Entity to store face embeddings/encodings in SQLite database
 * This stores the mathematical representation of each employee's face
 */
@Entity(tableName = "face_embeddings")
@TypeConverters(FloatArrayConverter::class)
data class FaceEmbedding(
    @PrimaryKey
    val employeeId: String,           // Links to Employee.id
    val encoding: FloatArray,         // Face encoding (128-dimensional vector)
    val croppedFacePath: String,      // Path to cropped face image
    val confidence: Float,            // Confidence score of face detection
    val registrationDate: Long = System.currentTimeMillis()
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as FaceEmbedding

        if (employeeId != other.employeeId) return false
        if (!encoding.contentEquals(other.encoding)) return false
        if (croppedFacePath != other.croppedFacePath) return false
        if (confidence != other.confidence) return false
        if (registrationDate != other.registrationDate) return false

        return true
    }

    override fun hashCode(): Int {
        var result = employeeId.hashCode()
        result = 31 * result + encoding.contentHashCode()
        result = 31 * result + croppedFacePath.hashCode()
        result = 31 * result + confidence.hashCode()
        result = 31 * result + registrationDate.hashCode()
        return result
    }
}

/**
 * Type converter to store FloatArray in SQLite database
 */
class FloatArrayConverter {
    @TypeConverter
    fun fromFloatArray(array: FloatArray): String {
        return array.joinToString(",")
    }

    @TypeConverter
    fun toFloatArray(data: String): FloatArray {
        return if (data.isEmpty()) {
            floatArrayOf()
        } else {
            data.split(",").map { it.toFloat() }.toFloatArray()
        }
    }
}