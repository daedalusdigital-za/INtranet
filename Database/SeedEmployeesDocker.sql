-- Simplified Seed Employees SQL Script
-- For ProjectTrackerDB schema
-- Default password hash for "Welcome123!" 
DECLARE @DefaultPasswordHash NVARCHAR(MAX) = '$2a$11$K8rBpQqKEGLEJVfcnqxQNO.aJQxpfQxqK6v1s7J2L1aHRKmqOjMVC';

-- Step 1: Ensure Departments exist
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Reception')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Reception', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Accounts')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Accounts', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Sales')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Sales', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Stock')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Stock', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Logistics')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Logistics', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Production')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Production', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Marketing')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Marketing', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Finance')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Finance', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'Training')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('Training', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'IT')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('IT', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Departments WHERE Name = 'HR')
    INSERT INTO Departments (Name, CreatedAt) VALUES ('HR', GETUTCDATE());

PRINT 'Departments created/verified';

-- Create temp table for employee data
CREATE TABLE #EmployeeData (
    Name NVARCHAR(100),
    Surname NVARCHAR(100),
    Email NVARCHAR(255),
    Title NVARCHAR(100),
    Department NVARCHAR(100),
    Ext1 NVARCHAR(20),
    Role NVARCHAR(50)
);

-- Insert employee data (simplified - one extension per employee)
INSERT INTO #EmployeeData VALUES ('Reception', 'Desk', 'reception@accessmedical.co.za', 'Receptionist', 'Reception', '100', 'Employee');
INSERT INTO #EmployeeData VALUES ('Ashveer', 'Pillay', 'ashveer@promedtechnologies.co.za', 'Sales Representative', 'Sales', '102', 'Employee');
INSERT INTO #EmployeeData VALUES ('Velosha', 'Naidoo', 'orders@promedtechnologies.co.za', 'Orders Coordinator', 'Sales', '703', 'Employee');
INSERT INTO #EmployeeData VALUES ('Shanice', 'Govender', 'stock@promedpharmacare.co.za', 'Stock Controller', 'Stock', '103', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mamo', 'Dlamini', 'acconts11@promedtechnologies.co.za', 'Accounts Clerk', 'Accounts', '104', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nhlonipho', 'Zulu', 'accounts1@promedtechnologies.co.za', 'Accounts Clerk', 'Accounts', '105', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nduduzo', 'Mkhize', 'accounts5@promedtechnologies.co.za', 'Accounts Clerk', 'Accounts', '107', 'Employee');
INSERT INTO #EmployeeData VALUES ('Karishma', 'Moonsamy', 'production1@promedpharmare.co.za', 'Production Supervisor', 'Production', '108', 'Employee');
INSERT INTO #EmployeeData VALUES ('Calvin', 'Peters', 'marketing@promedtechnologie.co.za', 'Marketing Manager', 'Marketing', '109', 'Manager');
INSERT INTO #EmployeeData VALUES ('Norel', 'Singh', 'norel@accessmedical.co.za', 'Sales Representative', 'Sales', '110', 'Employee');
INSERT INTO #EmployeeData VALUES ('Xoli', 'Ndlovu', 'logistics1@promedtechnologies.co.za', 'Logistics Coordinator', 'Logistics', '111', 'Employee');
INSERT INTO #EmployeeData VALUES ('Abby', 'Williams', 'abbigail@promedtechnologies.co.za', 'Sales Representative', 'Sales', '112', 'Employee');
INSERT INTO #EmployeeData VALUES ('Karusha', 'Naidoo', 'karusha@promedtechnologies.co.za', 'Sales Representative', 'Sales', '113', 'Employee');
INSERT INTO #EmployeeData VALUES ('Buancha', 'Maharaj', 'buancha@promedtechnologies.co.za', 'Sales Representative', 'Sales', '114', 'Employee');
INSERT INTO #EmployeeData VALUES ('Deon', 'van der Merwe', 'logistics3@promedtechnologies.co.za', 'Logistics Manager', 'Logistics', '115', 'Manager');
INSERT INTO #EmployeeData VALUES ('Coleen', 'Adams', 'coleen@promedtechnologies.co.za', 'Accounts Manager', 'Accounts', '116', 'Manager');
INSERT INTO #EmployeeData VALUES ('Anesh', 'Pillay', 'logistics2@promedtechnologies.co.za', 'Logistics Coordinator', 'Logistics', '117', 'Employee');
INSERT INTO #EmployeeData VALUES ('Jennifer', 'Stock', 'stock@accessmedical.co.za', 'Stock Controller', 'Stock', '118', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mbali', 'Finance', 'accounts10@promedtechnologies.co.za', 'Finance Officer', 'Finance', '201', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mandy', 'Thompson', 'mandy@accessmedical.co.za', 'Sales Representative', 'Sales', '707', 'Employee');
INSERT INTO #EmployeeData VALUES ('Ahistar', 'Reddy', 'sales1@promedpharmacare.co.za', 'Sales Executive', 'Sales', '203', 'Employee');
INSERT INTO #EmployeeData VALUES ('Maksooda', 'Khan', 'maksooda@promedtechnologies.co.za', 'Sales Representative', 'Sales', '206', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nash', 'Govender', 'nash22.govender@gmail.com', 'IT Technician', 'IT', '911', 'Employee');
INSERT INTO #EmployeeData VALUES ('Duran', 'Govender', 'duran24govender@gmail.com', 'IT Support', 'IT', '666', 'Employee');
INSERT INTO #EmployeeData VALUES ('Jerwayne', 'Govender', 'jerwaynegovender@gmail.com', 'Sales Representative', 'Sales', NULL, 'Employee');
INSERT INTO #EmployeeData VALUES ('Kajal', 'Maharaj', 'acconts2@accessmedical.co.za', 'Accounts Clerk', 'Accounts', '205', 'Employee');
INSERT INTO #EmployeeData VALUES ('Noori', 'Ismail', 'accounts8@promedtechnologies.co.za', 'Accounts Clerk', 'Accounts', '207', 'Employee');
INSERT INTO #EmployeeData VALUES ('Hlengiwe', 'Khumalo', 'hlengiwe@promedtechnologies.co.za', 'Sales Representative', 'Sales', '208', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mpilo', 'Sithole', 'mpilo@promedtechnologies.co.za', 'Sales Representative', 'Sales', '210', 'Employee');
INSERT INTO #EmployeeData VALUES ('Pearl', 'Mdlalose', 'pearl@accessmedical.co.za', 'Sales Representative', 'Sales', '209', 'Employee');
INSERT INTO #EmployeeData VALUES ('Thando', 'Nkosi', 'ryan@promedtechnologies.co.za', 'Sales Representative', 'Sales', '212', 'Employee');
INSERT INTO #EmployeeData VALUES ('Sisanda', 'Cele', 'stock1@sebenzanitrading.com', 'Stock Controller', 'Stock', '301', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mabaso', 'Wonder', 'wonder@sawellness.prop.sa', 'Sales Representative', 'Sales', '302', 'Employee');
INSERT INTO #EmployeeData VALUES ('Jennifer', 'Smith', 'jennifer@accessmedical.co.za', 'Sales Representative', 'Sales', '303', 'Employee');
INSERT INTO #EmployeeData VALUES ('Sydney', 'Msomi', 'stock@promedtechnologies.co.za', 'Stock Controller', 'Stock', '304', 'Employee');
INSERT INTO #EmployeeData VALUES ('Vinola', 'Padayachee', 'accounts7@promedtechnologies.co.za', 'Accounts Clerk', 'Accounts', '305', 'Employee');
INSERT INTO #EmployeeData VALUES ('Joyce', 'Mbatha', 'sales1@accessmedical.co.za', 'Sales Executive', 'Sales', '704', 'Employee');
INSERT INTO #EmployeeData VALUES ('Maggie', 'Ndaba', 'maggie@promedtechnologies.co.za', 'Sales Representative', 'Sales', '705', 'Employee');
INSERT INTO #EmployeeData VALUES ('Trisha', 'Pillay', 'trisha@promedechnologies.co.za', 'Sales Representative', 'Sales', '401', 'Employee');
INSERT INTO #EmployeeData VALUES ('Sphindile', 'Ngcobo', 'sphindile@promedtechnologies.co.za', 'Sales Representative', 'Sales', '404', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nomvelo', 'Gumede', 'sales2@promedtechnologies.co.za', 'Sales Executive', 'Sales', '714', 'Employee');
INSERT INTO #EmployeeData VALUES ('Thabile', 'Dube', 'thabile@promedtechnologies.co.za', 'Sales Representative', 'Sales', '403', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mpume', 'Zondi', 'sales3@promedtechnologies.co.za', 'Sales Executive', 'Sales', '706', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nelly', 'Shabalala', 'sales2@accessmedical.co.za', 'Sales Executive', 'Sales', '710', 'Employee');
INSERT INTO #EmployeeData VALUES ('Anisha', 'Chetty', 'anisha@promedtechnologies.co.za', 'Sales Representative', 'Sales', '409', 'Employee');
INSERT INTO #EmployeeData VALUES ('Akhona', 'Mthembu', 'akhona@promedtechnologies.co.za', 'Sales Representative', 'Sales', '701', 'Employee');
INSERT INTO #EmployeeData VALUES ('Aldrisha', 'Naidu', 'aldrisha@promedtechnologies.co.za', 'Sales Representative', 'Sales', '708', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nkosikhona', 'Mbatha', 'sales7@promedtechnologies.co.za', 'Sales Executive', 'Sales', '712', 'Employee');
INSERT INTO #EmployeeData VALUES ('Swelihle', 'Buthelezi', 'swelihle@promedtechnologies.co.za', 'Sales Representative', 'Sales', '713', 'Employee');
INSERT INTO #EmployeeData VALUES ('Keith', 'Roberts', 'sales1@promedtechnologies.co.za', 'Sales Manager', 'Sales', '715', 'Manager');
INSERT INTO #EmployeeData VALUES ('Nkosikhona', 'Bhengu', 'sales10@promedtechnologies.co.za', 'Sales Executive', 'Sales', '716', 'Employee');
INSERT INTO #EmployeeData VALUES ('Nosipho', 'Zwane', 'sales16@promedtechnologies.co.za', 'Sales Executive', 'Sales', '718', 'Employee');
INSERT INTO #EmployeeData VALUES ('Sthabile', 'Madonsela', 'sales5@accessmedical.co.za', 'Sales Executive', 'Sales', '725', 'Employee');
INSERT INTO #EmployeeData VALUES ('Emeline', 'Moyo', 'sales4@promedtechnologies.co.za', 'Sales Executive', 'Sales', '726', 'Employee');
INSERT INTO #EmployeeData VALUES ('Mandisa', 'Ntuli', 'sales11@promedtechnologies.co.za', 'Sales Executive', 'Sales', '728', 'Employee');
INSERT INTO #EmployeeData VALUES ('Vuyiswa', 'Khoza', 'sales3@sebenzanitrading.com', 'Sales Executive', 'Sales', '724', 'Employee');
INSERT INTO #EmployeeData VALUES ('Zandile', 'Msomi', 'sales1@sebenzanitrading.com', 'Sales Executive', 'Sales', '730', 'Employee');
INSERT INTO #EmployeeData VALUES ('Zandile', 'Mkhize', 'sales9@promedtechnologies.co.za', 'Sales Executive', 'Sales', '729', 'Employee');
INSERT INTO #EmployeeData VALUES ('Cynthia', 'Ngubane', 'sales8@accessmedical.co.za', 'Sales Executive', 'Sales', '702', 'Employee');
INSERT INTO #EmployeeData VALUES ('Thabsile', 'Mthethwa', 'thabsile@accessmedical.co.za', 'Sales Representative', 'Sales', '727', 'Employee');
INSERT INTO #EmployeeData VALUES ('Hlaka', 'Zuma', 'training@promedtechnlogies.co.za', 'Training Manager', 'Training', '722', 'Manager');
INSERT INTO #EmployeeData VALUES ('Pinky', 'Molefe', 'sales4@accessmedical.co.za', 'Sales Executive', 'Sales', '721', 'Employee');
INSERT INTO #EmployeeData VALUES ('Smangele', 'Maseko', 'sales3@accessmedical.co.za', 'Sales Executive', 'Sales', '732', 'Employee');
INSERT INTO #EmployeeData VALUES ('Amanda', 'Majola', 'sales10@accessmedical.co.za', 'Sales Executive', 'Sales', '709', 'Employee');
INSERT INTO #EmployeeData VALUES ('Lisa', 'Van Rooyen', 'sales6@promedtechnologies.co.za', 'Sales Executive', 'Sales', '731', 'Employee');
INSERT INTO #EmployeeData VALUES ('Sarah', 'Johnson', 'hr@promedtechnologies.co.za', 'HR Manager', 'HR', '500', 'Manager');
INSERT INTO #EmployeeData VALUES ('Michael', 'Chen', 'it.manager@promedtechnologies.co.za', 'IT Manager', 'IT', '501', 'Manager');
INSERT INTO #EmployeeData VALUES ('Priya', 'Naicker', 'finance.manager@promedtechnologies.co.za', 'Finance Manager', 'Finance', '502', 'Manager');

PRINT 'Employee data prepared';

-- Step 3: Insert Users
INSERT INTO Users (Name, Surname, Email, PasswordHash, Role, Title, DepartmentId, IsActive, CreatedAt)
SELECT 
    e.Name,
    ISNULL(e.Surname, ''),
    e.Email,
    @DefaultPasswordHash,
    e.Role,
    e.Title,
    (SELECT TOP 1 DepartmentId FROM Departments WHERE Name = e.Department),
    1,
    GETUTCDATE()
FROM #EmployeeData e
WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Email = e.Email);

PRINT 'Users inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- Step 4: Insert Extensions and link to users
INSERT INTO Extensions (ExtensionNumber, Label, ExtensionType, UserId, IsActive, IsPrimary, CreatedAt)
SELECT 
    e.Ext1,
    'Direct Line',
    'Phone',
    (SELECT TOP 1 UserId FROM Users WHERE Email = e.Email),
    1,
    1,
    GETUTCDATE()
FROM #EmployeeData e
WHERE e.Ext1 IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM Extensions WHERE ExtensionNumber = e.Ext1);

PRINT 'Extensions inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- Cleanup temp table
DROP TABLE #EmployeeData;

-- Final counts
SELECT 'Summary' AS Report;
SELECT 
    (SELECT COUNT(*) FROM Users) AS TotalUsers,
    (SELECT COUNT(*) FROM Extensions) AS TotalExtensions,
    (SELECT COUNT(*) FROM Departments) AS TotalDepartments;

SELECT 'Users by Department' AS Report;
SELECT d.Name AS Department, COUNT(u.UserId) AS EmployeeCount
FROM Departments d
LEFT JOIN Users u ON u.DepartmentId = d.DepartmentId
GROUP BY d.Name
ORDER BY EmployeeCount DESC;

PRINT 'Employee seeding complete!';
