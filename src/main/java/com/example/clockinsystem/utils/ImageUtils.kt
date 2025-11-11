package com.example.clockinsystem.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File

object ImageUtils {
    fun loadImageFromPath(context: Context, imagePath: String): Bitmap? {
        return try {
            if (imagePath.isNotEmpty()) {
                val file = File(imagePath)
                if (file.exists()) {
                    BitmapFactory.decodeFile(imagePath)
                } else {
                    null
                }
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}