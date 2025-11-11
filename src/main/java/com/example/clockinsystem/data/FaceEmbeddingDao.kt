package com.example.clockinsystem.data

import androidx.room.*
import com.example.clockinsystem.model.FaceEmbedding

/**
 * Data Access Object for face embeddings
 * Handles database operations for face encodings
 */
@Dao
interface FaceEmbeddingDao {
    
    @Query("SELECT * FROM face_embeddings")
    suspend fun getAllFaceEmbeddings(): List<FaceEmbedding>
    
    @Query("SELECT * FROM face_embeddings WHERE employeeId = :employeeId")
    suspend fun getFaceEmbeddingByEmployeeId(employeeId: String): FaceEmbedding?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFaceEmbedding(faceEmbedding: FaceEmbedding)
    
    @Update
    suspend fun updateFaceEmbedding(faceEmbedding: FaceEmbedding)
    
    @Delete
    suspend fun deleteFaceEmbedding(faceEmbedding: FaceEmbedding)
    
    @Query("DELETE FROM face_embeddings WHERE employeeId = :employeeId")
    suspend fun deleteFaceEmbeddingByEmployeeId(employeeId: String)
    
    @Query("SELECT COUNT(*) FROM face_embeddings")
    suspend fun getRegisteredFaceCount(): Int
    
    @Query("SELECT employeeId FROM face_embeddings")
    suspend fun getRegisteredEmployeeIds(): List<String>
}