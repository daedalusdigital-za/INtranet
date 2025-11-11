package com.example.clockinsystem.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Update
import androidx.room.Delete
import androidx.room.Query
import androidx.room.OnConflictStrategy
import com.example.clockinsystem.model.Employee

@Dao
interface EmployeeDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(employee: Employee)

    @Update
    suspend fun update(employee: Employee)

    @Delete
    suspend fun delete(employee: Employee)

    @Query("SELECT * FROM employees WHERE id = :employeeId")
    suspend fun getEmployeeById(employeeId: String): Employee?

    @Query("SELECT * FROM employees")
    suspend fun getAllEmployees(): List<Employee>

    @Query("DELETE FROM employees WHERE id = :employeeId")
    suspend fun deleteEmployee(employeeId: String)
}