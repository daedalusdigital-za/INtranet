-- =============================================================================
-- Import drivers from the depot datasheet (PE/GQEBERHA, KZN, CT, Johannesburg).
-- Idempotent: only inserts a driver when no existing row has the same
-- FirstName + LastName (case-insensitive). Safe to re-run.
--
-- Field mapping:
--   NAME          -> FirstName
--   SURNAME       -> LastName
--   DRIVERS CODE  -> LicenseType   (e.g. 'EC Code 14', 'C1 Code 10', 'B Code 8')
--   ID NUMBER     -> EmployeeNumber (SA national ID; also encodes DOB)
--   EXPIRE DATE   -> LicenseExpiryDate
--   DOB (YYMMDD)  -> DateOfBirth   (derived from the SA ID number, 19xx)
-- =============================================================================

SET NOCOUNT ON;

DECLARE @incoming TABLE (
    FirstName        NVARCHAR(100),
    LastName         NVARCHAR(100),
    LicenseType      NVARCHAR(50),
    EmployeeNumber   NVARCHAR(50),
    LicenseExpiry    DATE NULL,
    DateOfBirth      DATE NULL
);

INSERT INTO @incoming (FirstName, LastName, LicenseType, EmployeeNumber, LicenseExpiry, DateOfBirth) VALUES
-- ── PE / GQEBERHA ──
('SP',                 'MCHUNU',   'EC Code 14', '8505057279085', '2030-01-07', '1985-05-05'),
('SIYABONGA',          'MSANI',    'C1 Code 10', '9612315872088', '2030-11-07', '1996-12-31'),
('MLONDI',             'NKOMO',    'C1 Code 10', '9607256174080', '2030-10-11', '1996-07-25'),
('SPHEPHELO',          'MATHONSI', 'C1 Code 10', '9412305846089', '2030-01-12', '1994-12-30'),
('MFANAFUTHI',         'NGCOBO',   'C1 Code 10', '8611165670085', '2029-04-02', '1986-11-16'),
('MTHOKOZISI',         'MAKHANYA', 'C1 Code 10', '9705015147080', '2031-01-07', '1997-05-01'),
-- ── KZN ──
('PATRIC',             'KHANYILE', 'EC Code 14', NULL,            NULL,         NULL),
('Mike',               '-',        'EC Code 14', '200812XFJ003',  '2029-10-08', NULL),
('NJABULO CHARLES',    'MAKHANYA', 'EC Code 14', '9306205501085', NULL,         '1993-06-20'),
('LUYANDA LUTHER',     'XASA',     'EC Code 14', '7704275801082', '2029-07-31', '1977-04-27'),
('MJ',                 'MZILA',    'C1 Code 10', '8305235461089', '2030-02-14', '1983-05-23'),
('SIYABONGA',          'MTHETHWA', 'C1 Code 10', '8610116171081', '2030-03-07', '1986-10-11'),
('NHLAKA W',           'DUBE',     'C1 Code 10', '9305095624080', '2030-03-11', '1993-05-09'),
('MJ',                 'NGUBANE',  'C1 Code 10', '8702025516082', '2030-06-05', '1987-02-02'),
('SIYABONGA',          'NDIMANDE', 'C1 Code 10', '9006226079083', '2028-10-18', '1990-06-22'),
('BUHLE S',            'NENE',     'C1 Code 10', '9406105355085', '2029-11-14', '1994-06-10'),
('SIZWE P',            'KUBHEKA',  'EC Code 14', '8006235557088', '2030-01-11', '1980-06-23'),
('LUCAS A',            'KHUMALO',  'C1 Code 10', '8009044624080', '2028-07-02', '1980-09-04'),
('SMANGA P',           'ZUNGU',    'C1 Code 10', '9402275805082', '2029-10-17', '1994-02-27'),
('Nkululeko',          'Manyisa',  'EC Code 14', '8605255949081', '2028-04-07', '1986-05-25'),
('ZOLANI M',           'MTSHALI',  'C1 Code 10', '9804175376082', '2030-03-08', '1998-04-17'),
-- ── CT / CAPE TOWN ──
('NKOSINATHI SIZWE',   'MSWELI',   'C1 Code 10', '8909255956082', '2031-05-21', '1989-09-25'),
('SIYABONGA ANELE',    'MSOMI',    'C1 Code 10', '9612315872088', NULL,         '1996-12-31'),
('MZUVUKILE LAWRENCE', 'JIM',      'EC Code 14', '9306175569088', '2031-05-22', '1993-06-17'),
('NQOBANI SIMPHIWE',   'MTHIYA',   'EC Code 14', '9602215919089', '2030-12-21', '1996-02-21'),
('MPHO DERICK',        'MANGOPE',  'B Code 8',   '8208035917088', '2028-03-22', '1982-08-03'),
('SIMPHIWE PRECIVAL',  'MSANE',    'C1 Code 10', '9110255342089', '2029-10-30', '1991-10-25'),
-- ── JOHANNESBURG ──
('ST',                 'MACWAZA',  'EC Code 14', '9601016467082', '2029-10-04', '1996-01-01'),
('MFUNDO NEVILE',      'CELE',     'EC Code 14', '8211045980088', '2030-09-10', '1982-11-04'),
('THEMBINKOSI VICTOR', 'MASINGA',  'C1 Code 10', '7407185542081', '2029-04-22', '1974-07-18'),
('LUNGELO TRINITY',    'BIYELA',   'C1 Code 10', '9208015669088', '2031-03-06', '1992-08-01'),
('MTHOBISI WILBERT',   'MAKHANYA', 'C1 Code 10', '9001017307082', '2030-03-07', '1990-01-01'),
('SCELO',              'NDOVELA',  'C1 Code 10', '7712256933089', '2031-04-10', '1977-12-25'),
('SIYABONGA THANKS',   'MABENA',   'C1 Code 10', '8007215293082', '2030-02-01', '1980-07-21'),
('SIYANDA',            'MNCWABE',  'EC Code 14', '9602115255089', '2029-06-06', '1996-02-11'),
('LINDOKUHLE',         'SHUDE',    'C1 Code 10', '9404046199084', '2029-01-20', '1994-04-04'),
('GEORGE',             'CHEMBENE', 'EC Code 14', '9808135787080', '2030-03-16', '1998-08-13'),
('BONGINKOSI',         'MGOBHOZI', 'EC Code 14', '9511105692080', '2029-08-26', '1995-11-10');

-- Insert only drivers that are not already present (match on FirstName + LastName).
INSERT INTO Drivers
    (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate,
     EmployeeNumber, Status, DateOfBirth, CreatedAt)
SELECT
    i.FirstName, i.LastName, '', i.LicenseType, i.LicenseExpiry,
    i.EmployeeNumber, 'Active', i.DateOfBirth, SYSUTCDATETIME()
FROM @incoming i
WHERE NOT EXISTS (
    SELECT 1 FROM Drivers d
    WHERE LOWER(LTRIM(RTRIM(d.FirstName))) = LOWER(LTRIM(RTRIM(i.FirstName)))
      AND LOWER(LTRIM(RTRIM(d.LastName)))  = LOWER(LTRIM(RTRIM(i.LastName)))
)
-- Also skip if the datasheet surname already exists as a rough single-name record
-- (older imports stored the surname in FirstName with LastName = '-').
AND NOT EXISTS (
    SELECT 1 FROM Drivers d
    WHERE d.LastName = '-'
      AND LOWER(LTRIM(RTRIM(d.FirstName))) = LOWER(LTRIM(RTRIM(i.LastName)))
);

DECLARE @inserted INT = @@ROWCOUNT;
PRINT 'Drivers inserted from datasheet: ' + CAST(@inserted AS NVARCHAR(10));

SELECT COUNT(*) AS TotalDriversNow FROM Drivers;
