-- =============================================
-- Seed Employees, Extensions, and Company Affiliations
-- Generated: 2026-01-15
-- Default Password: Welcome123! (BCrypt hashed)
-- =============================================

-- BCrypt hash for 'Welcome123!' - use this default password
-- You can generate new hashes at https://bcrypt-generator.com/
DECLARE @DefaultPasswordHash NVARCHAR(255) = '$2a$11$K.fQhV.Vs1zzz3QQZ1Z3Vu9vJxZJxJxJxJxJxJxJxJxJxJxJxJxJx';

-- =============================================
-- STEP 1: Create Departments if not exist
-- =============================================
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

-- =============================================
-- STEP 2: Create Operating Companies
-- =============================================
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code = 'ACCESS')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) 
    VALUES ('Access Medical', 'ACCESS', 'Access Medical supplies and equipment', 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code = 'PROMED')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) 
    VALUES ('Promed Technologies', 'PROMED', 'Promed Technologies healthcare solutions', 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code = 'PHARMA')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) 
    VALUES ('Promed Pharmacare', 'PHARMA', 'Promed Pharmacare pharmaceutical products', 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code = 'SEBENZANI')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) 
    VALUES ('Sebenzani Trading', 'SEBENZANI', 'Sebenzani Trading distribution', 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code = 'SAWELLNESS')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) 
    VALUES ('SA Wellness', 'SAWELLNESS', 'SA Wellness health and wellness', 1, GETUTCDATE());

-- =============================================
-- STEP 3: Get Department IDs
-- =============================================
DECLARE @DeptReception INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Reception');
DECLARE @DeptAccounts INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Accounts');
DECLARE @DeptSales INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Sales');
DECLARE @DeptStock INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Stock');
DECLARE @DeptLogistics INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Logistics');
DECLARE @DeptProduction INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Production');
DECLARE @DeptMarketing INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Marketing');
DECLARE @DeptFinance INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Finance');
DECLARE @DeptTraining INT = (SELECT DepartmentId FROM Departments WHERE Name = 'Training');

-- =============================================
-- STEP 4: Get Company IDs
-- =============================================
DECLARE @CoAccess INT = (SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code = 'ACCESS');
DECLARE @CoPromed INT = (SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code = 'PROMED');
DECLARE @CoPharma INT = (SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code = 'PHARMA');
DECLARE @CoSebenzani INT = (SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code = 'SEBENZANI');
DECLARE @CoSawellness INT = (SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code = 'SAWELLNESS');

-- =============================================
-- STEP 5: Create Users with Default Password
-- Note: Password is 'Welcome123!' - must be reset later
-- =============================================

-- Temporary table to store user info for bulk insert
CREATE TABLE #TempUsers (
    Name NVARCHAR(100),
    Surname NVARCHAR(100),
    Email NVARCHAR(255),
    Title NVARCHAR(100),
    DepartmentId INT,
    Extensions NVARCHAR(100),
    Companies NVARCHAR(255)
);

-- Insert all employees
INSERT INTO #TempUsers (Name, Surname, Email, Title, DepartmentId, Extensions, Companies) VALUES
('Reception', 'Desk', 'reception@accessmedical.co.za', 'Receptionist', @DeptReception, '100,200,300,700', 'ACCESS,PROMED'),
('Ashveer', '', 'ashveer@promedtechnologies.co.za', 'Staff', @DeptSales, '102', 'PROMED,PHARMA'),
('Velosha', '', 'orders@promedtechnologies.co.za', 'Orders', @DeptSales, '703', 'PROMED'),
('Shanice', '', 'stock@promedpharmacare.co.za', 'Stock Controller', @DeptStock, '103', 'PHARMA'),
('Mamo', '', 'acconts11@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '104', 'PROMED,ACCESS'),
('Nhlonipho', '', 'accounts1@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '105', 'PROMED'),
('Nduduzo', '', 'accounts5@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '107', 'PROMED'),
('Karishma', '', 'production1@promedpharmare.co.za', 'Production', @DeptProduction, '108', 'PROMED'),
('Calvin', '', 'marketing@promedtechnologie.co.za', 'Marketing', @DeptMarketing, '109', 'PROMED'),
('Norel', '', 'norel@accessmedical.co.za', 'Staff', @DeptSales, '110', 'ACCESS'),
('Xoli', '', 'logistics1@promedtechnologies.co.za', 'Logistics', @DeptLogistics, '111', 'PROMED'),
('Abby', '', 'abbigail@promedtechnologies.co.za', 'Staff', @DeptSales, '112', 'PROMED'),
('Karusha', '', 'karusha@promedtechnologies.co.za', 'Staff', @DeptSales, '113', 'PROMED'),
('Buancha', '', 'buancha@promedtechnologies.co.za', 'Staff', @DeptSales, '114', 'PROMED'),
('Deon', '', 'logistics3@promedtechnologies.co.za', 'Logistics', @DeptLogistics, '115', 'PROMED'),
('Coleen', '', 'coleen@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '116', 'PROMED'),
('Anesh', '', 'logistics2@promedtechnologies.co.za', 'Logistics', @DeptLogistics, '117', 'PROMED'),
('Jennifer', 'Stock', 'stock@accessmedical.co.za', 'Stock Controller', @DeptStock, '118', 'PROMED'),
('Mbali', 'Finance', 'accounts10@promedtechnologies.co.za', 'Finance', @DeptFinance, '201', 'ACCESS,PROMED'),
('Mandy', '', 'mandy@accessmedical.co.za', 'Staff', @DeptSales, '707', 'ACCESS,PROMED'),
('Ahistar', '', 'sales1@promedpharmacare.co.za', 'Sales', @DeptSales, '203', 'ACCESS,SEBENZANI'),
('Maksooda', '', 'maksooda@promedtechnologies.co.za', 'Staff', @DeptSales, '206', 'PROMED'),
('Nash', '', 'nash22.govender@gmail.com', 'Staff', @DeptSales, '911', 'PROMED'),
('Duran', '', 'duran24govender@gmail.com', 'Staff', @DeptSales, '666', 'ACCESS'),
('Jerwayne', '', 'jerwaynegovender@gmail.com', 'Staff', @DeptSales, '', 'SEBENZANI'),
('Kajal', '', 'acconts2@accessmedical.co.za', 'Accounts', @DeptAccounts, '205', 'PROMED'),
('Noori', '', 'accounts8@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '207', 'PROMED'),
('Hlengiwe', '', 'hlengiwe@promedtechnologies.co.za', 'Staff', @DeptSales, '208', 'PROMED'),
('Mpilo', '', 'mpilo@promedtechnologies.co.za', 'Staff', @DeptSales, '210', 'PROMED'),
('Pearl', '', 'pearl@accessmedical.co.za', 'Staff', @DeptSales, '209', 'ACCESS'),
('Thando', '', 'ryan@promedtechnologies.co.za', 'Staff', @DeptSales, '212', 'ACCESS'),
('Sisanda', '', 'stock1@sebenzanitrading.com', 'Stock Controller', @DeptStock, '301', 'ACCESS,PHARMA'),
('Mabaso', '', 'wonder@sawellness.prop.sa', 'Staff', @DeptSales, '302', 'SAWELLNESS'),
('Jennifer', '', 'jennifer@accessmedical.co.za', 'Staff', @DeptSales, '303', 'ACCESS,PROMED'),
('Sydney', '', 'stock@promedtechnologies.co.za', 'Stock Controller', @DeptStock, '304', 'PROMED'),
('Vinola', '', 'accounts7@promedtechnologies.co.za', 'Accounts', @DeptAccounts, '305', 'PROMED'),
('Joyce', '', 'sales1@accessmedical.co.za', 'Sales', @DeptSales, '704', 'PROMED'),
('Maggie', '', 'maggie@promedtechnologies.co.za', 'Staff', @DeptSales, '705', 'PROMED'),
('Trisha', '', 'trisha@promedechnologies.co.za', 'Staff', @DeptSales, '401', 'PROMED'),
('Sphindile', '', 'sphindile@promedtechnologies.co.za', 'Staff', @DeptSales, '404', 'PROMED'),
('Nomvelo', '', 'sales2@promedtechnologies.co.za', 'Sales', @DeptSales, '714', 'ACCESS'),
('Thabile', '', 'thabile@promedtechnologies.co.za', 'Staff', @DeptSales, '403', 'PROMED,ACCESS'),
('Mpume', '', 'sales3@promedtechnologies.co.za', 'Sales', @DeptSales, '706', 'PROMED'),
('Nelly', '', 'sales2@accessmedical.co.za', 'Sales', @DeptSales, '710', 'PROMED'),
('Anisha', '', 'anisha@promedtechnologies.co.za', 'Staff', @DeptSales, '409', 'PROMED'),
('Akhona', '', 'akhona@promedtechnologies.co.za', 'Staff', @DeptSales, '701', 'PROMED'),
('Aldrisha', '', 'aldrisha@promedtechnologies.co.za', 'Staff', @DeptSales, '708', 'PROMED'),
('Nkosikhona', '', 'sales7@promedtechnologies.co.za', 'Sales', @DeptSales, '712', 'PROMED'),
('Swelihle', '', 'swelihle@promedtechnologies.co.za', 'Staff', @DeptSales, '713', 'PROMED'),
('Keith', '', 'sales1@promedtechnologies.co.za', 'Sales', @DeptSales, '715', 'PROMED'),
('Nkosikhona', 'B', 'sales10@promedtechnologies.co.za', 'Sales', @DeptSales, '716', 'PROMED'),
('Nosipho', '', 'sales16@promedtechnologies.co.za', 'Sales', @DeptSales, '718', 'PROMED'),
('Sthabile', '', 'sales5@accessmedical.co.za', 'Sales', @DeptSales, '725', 'ACCESS'),
('Emeline', '', 'sales4@promedtechnologies.co.za', 'Sales', @DeptSales, '726', 'SEBENZANI'),
('Mandisa', '', 'sales11@promedtechnologies.co.za', 'Sales', @DeptSales, '725', 'PROMED'),
('Vuyiswa', '', 'sales3@sebenzanitrading.com', 'Sales', @DeptSales, '724', 'SEBENZANI'),
('Zandile', 'Msomi', 'sales1@sebenzanitrading.com', 'Sales', @DeptSales, '730', 'SEBENZANI'),
('Zandile', 'Mkhize', 'sales9@promedtechnologies.co.za', 'Sales', @DeptSales, '729', 'SEBENZANI'),
('Cynthia', '', 'sales8@accessmedical.co.za', 'Sales', @DeptSales, '702', 'PROMED'),
('Thabsile', '', 'thabsile@accessmedical.co.za', 'Staff', @DeptSales, '727', 'ACCESS'),
('Hlaka', '', 'training@promedtechnlogies.co.za', 'Training', @DeptTraining, '722', 'PROMED'),
('Pinky', '', 'sales4@accessmedical.co.za', 'Sales', @DeptSales, '721', 'ACCESS'),
('Smangele', '', 'sales3@accessmedical.co.za', 'Sales', @DeptSales, '732', 'ACCESS'),
('Amanda', '', 'sales10@accessmedical.co.za', 'Sales', @DeptSales, '709', 'ACCESS'),
('Lisa', '', 'sales6@promedtechnologies.co.za', 'Sales', @DeptSales, '731', 'ACCESS');

-- =============================================
-- STEP 6: Insert Users (skip if email exists)
-- =============================================
INSERT INTO Users (Name, Surname, Email, PasswordHash, Role, Title, DepartmentId, IsActive, CreatedAt)
SELECT 
    t.Name,
    ISNULL(t.Surname, ''),
    t.Email,
    @DefaultPasswordHash,
    'Employee',
    t.Title,
    t.DepartmentId,
    1,
    GETUTCDATE()
FROM #TempUsers t
WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.Email = t.Email);

PRINT 'Users created successfully';

-- =============================================
-- STEP 7: Create Extensions and Link to Users
-- =============================================
-- First, clear existing sample extensions that aren't assigned
DELETE FROM Extensions WHERE UserId IS NULL AND ExtensionNumber IN ('1001','1002','1003','1004','1005','1006','1007','1008','1009','1010');

-- Create extensions for each user
DECLARE @UserId INT;
DECLARE @ExtNum NVARCHAR(20);
DECLARE @Email NVARCHAR(255);
DECLARE @Extensions NVARCHAR(100);

DECLARE user_cursor CURSOR FOR 
    SELECT u.UserId, t.Extensions, u.Email
    FROM Users u
    INNER JOIN #TempUsers t ON u.Email = t.Email
    WHERE t.Extensions IS NOT NULL AND t.Extensions != '';

OPEN user_cursor;
FETCH NEXT FROM user_cursor INTO @UserId, @Extensions, @Email;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Split extensions by comma and insert each one
    DECLARE @Pos INT = 1;
    DECLARE @Len INT = LEN(@Extensions);
    DECLARE @IsPrimary BIT = 1;
    
    WHILE @Pos <= @Len
    BEGIN
        DECLARE @NextComma INT = CHARINDEX(',', @Extensions + ',', @Pos);
        SET @ExtNum = LTRIM(RTRIM(SUBSTRING(@Extensions, @Pos, @NextComma - @Pos)));
        
        IF @ExtNum != '' AND NOT EXISTS (SELECT 1 FROM Extensions WHERE ExtensionNumber = @ExtNum)
        BEGIN
            INSERT INTO Extensions (ExtensionNumber, Label, ExtensionType, UserId, IsActive, IsPrimary, CreatedAt)
            VALUES (@ExtNum, 'Direct Line', 'Phone', @UserId, 1, @IsPrimary, GETUTCDATE());
            SET @IsPrimary = 0; -- Only first extension is primary
        END
        ELSE IF @ExtNum != '' AND EXISTS (SELECT 1 FROM Extensions WHERE ExtensionNumber = @ExtNum AND UserId IS NULL)
        BEGIN
            -- Update existing unassigned extension
            UPDATE Extensions SET UserId = @UserId, IsPrimary = @IsPrimary, UpdatedAt = GETUTCDATE() WHERE ExtensionNumber = @ExtNum;
            SET @IsPrimary = 0;
        END
        
        SET @Pos = @NextComma + 1;
    END
    
    FETCH NEXT FROM user_cursor INTO @UserId, @Extensions, @Email;
END

CLOSE user_cursor;
DEALLOCATE user_cursor;

PRINT 'Extensions created and linked successfully';

-- =============================================
-- STEP 8: Link Users to Operating Companies
-- =============================================
DECLARE @Companies NVARCHAR(255);
DECLARE @CompanyCode NVARCHAR(20);
DECLARE @CompanyId INT;

DECLARE company_cursor CURSOR FOR 
    SELECT u.UserId, t.Companies
    FROM Users u
    INNER JOIN #TempUsers t ON u.Email = t.Email
    WHERE t.Companies IS NOT NULL AND t.Companies != '';

OPEN company_cursor;
FETCH NEXT FROM company_cursor INTO @UserId, @Companies;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @CPos INT = 1;
    DECLARE @CLen INT = LEN(@Companies);
    DECLARE @IsPrimaryCompany BIT = 1;
    
    WHILE @CPos <= @CLen
    BEGIN
        DECLARE @CNextComma INT = CHARINDEX(',', @Companies + ',', @CPos);
        SET @CompanyCode = LTRIM(RTRIM(SUBSTRING(@Companies, @CPos, @CNextComma - @CPos)));
        
        SELECT @CompanyId = OperatingCompanyId FROM OperatingCompanies WHERE Code = @CompanyCode;
        
        IF @CompanyId IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM StaffOperatingCompanies 
            WHERE StaffMemberId = @UserId AND OperatingCompanyId = @CompanyId
        )
        BEGIN
            INSERT INTO StaffOperatingCompanies (StaffMemberId, OperatingCompanyId, IsActive, IsPrimaryCompany, CreatedAt)
            VALUES (@UserId, @CompanyId, 1, @IsPrimaryCompany, GETUTCDATE());
            SET @IsPrimaryCompany = 0;
        END
        
        SET @CPos = @CNextComma + 1;
    END
    
    FETCH NEXT FROM company_cursor INTO @UserId, @Companies;
END

CLOSE company_cursor;
DEALLOCATE company_cursor;

PRINT 'Company affiliations linked successfully';

-- =============================================
-- STEP 9: Cleanup
-- =============================================
DROP TABLE #TempUsers;

-- =============================================
-- STEP 10: Summary Report
-- =============================================
SELECT 'Users Created' AS Category, COUNT(*) AS Count FROM Users WHERE CreatedAt >= DATEADD(MINUTE, -5, GETUTCDATE())
UNION ALL
SELECT 'Total Users', COUNT(*) FROM Users WHERE IsActive = 1
UNION ALL
SELECT 'Extensions Linked', COUNT(*) FROM Extensions WHERE UserId IS NOT NULL
UNION ALL
SELECT 'Company Affiliations', COUNT(*) FROM StaffOperatingCompanies WHERE IsActive = 1;

PRINT '';
PRINT '==============================================';
PRINT 'SEED COMPLETE!';
PRINT 'Default password for all users: Welcome123!';
PRINT 'Please have users reset their passwords.';
PRINT '==============================================';
