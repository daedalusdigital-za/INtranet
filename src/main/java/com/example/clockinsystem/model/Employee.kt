package com.example.clockinsystem.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "employees")
data class Employee(
    @PrimaryKey
    val id: String,
    val name: String,
    val referenceImagePath: String, // Store file path instead of Bitmap
    val fingerprintTemplate: String? = null // Store fingerprint template if available
)