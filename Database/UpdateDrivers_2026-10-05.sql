-- =============================================================================
-- Driver master update — 2026-10-05 licence audit list
-- Adds surnames, SA ID numbers (+DOB derived from ID), licence codes & expiry
-- dates; activates matched placeholder rows; inserts new drivers; links
-- vehicles where region + vehicle type is unambiguous.
-- Safe to re-run.
-- =============================================================================
USE ProjectTrackerDB;
GO
SET NOCOUNT ON;

-- ---------- Updates to existing driver rows ----------------------------------
UPDATE Drivers SET FirstName='SIYABONGA ELLIOT', LastName='MSANI', IdNumber='9006205730086', LicenseType='C1 Code 10', LicenseExpiryDate='2031-01-22', DateOfBirth='1990-06-20', Status='Active', UpdatedAt=GETDATE() WHERE Id=42;
UPDATE Drivers SET FirstName='MFANAFUTHI SEDRICK', LastName='NGCOBO', IdNumber='8511165670082', LicenseType='C1 Code 10', LicenseExpiryDate='2029-04-02', DateOfBirth='1985-11-16', Status='Active', UpdatedAt=GETDATE() WHERE Id=45;
UPDATE Drivers SET LastName='MAPHANGE', IdNumber='8507085622088', LicenseType='C1 Code 10', LicenseExpiryDate='2030-11-11', DateOfBirth='1985-07-08', Status='Active', UpdatedAt=GETDATE() WHERE Id=78; -- was MAHANGE
UPDATE Drivers SET IdNumber='9607256174080', LicenseType='EC Code 14', LicenseExpiryDate='2030-10-11', DateOfBirth='1996-07-25', UpdatedAt=GETDATE() WHERE Id=43; -- MLONDI NKOMO (was C1)
UPDATE Drivers SET IdNumber='8404056268085', LicenseType='EC Code 14', LicenseExpiryDate='2031-05-20', DateOfBirth='1984-04-05', UpdatedAt=GETDATE() WHERE Id=75; -- DOCTOR NYOKA (was C1)
UPDATE Drivers SET IdNumber='8006235557088', LicenseExpiryDate='2030-01-11', DateOfBirth='1980-06-23', UpdatedAt=GETDATE() WHERE Id=55; -- SIZWE KUBHEKA
UPDATE Drivers SET IdNumber='8009045624080', LicenseExpiryDate='2031-06-02', DateOfBirth='1980-09-04', UpdatedAt=GETDATE() WHERE Id=56; -- LUCAS KHUMALO
UPDATE Drivers SET IdNumber='9402275805082', LicenseExpiryDate='2030-10-27', DateOfBirth='1994-02-27', UpdatedAt=GETDATE() WHERE Id=57; -- SMANGA ZUNGU
UPDATE Drivers SET IdNumber='9804175376082', LicenseExpiryDate='2030-03-08', DateOfBirth='1998-04-17', UpdatedAt=GETDATE() WHERE Id=59; -- ZOLANI MTSHALI
UPDATE Drivers SET IdNumber='9412305846089', LicenseExpiryDate='2030-01-12', DateOfBirth='1994-12-30', UpdatedAt=GETDATE() WHERE Id=44; -- SPHEPHELO MATHONSI
UPDATE Drivers SET IdNumber='9705015147080', LicenseExpiryDate='2031-01-07', DateOfBirth='1997-05-01', UpdatedAt=GETDATE() WHERE Id=46; -- MTHOKOZISI MAKHANYA
UPDATE Drivers SET IdNumber='8909255956082', LicenseExpiryDate='2031-05-21', DateOfBirth='1989-09-25', UpdatedAt=GETDATE() WHERE Id=60; -- NKOSINATHI SIZWE MSWELI
UPDATE Drivers SET IdNumber='8208035917088', LicenseExpiryDate='2028-03-22', DateOfBirth='1982-08-03', UpdatedAt=GETDATE() WHERE Id=63; -- DERICK MANGOPE (list ID had a dropped digit; corrected to 13 digits)
UPDATE Drivers SET IdNumber='9110255342089', LicenseExpiryDate='2029-10-31', DateOfBirth='1991-10-25', UpdatedAt=GETDATE() WHERE Id=64; -- SIMPHIWE MSANE
UPDATE Drivers SET IdNumber='8211045980088', LicenseExpiryDate='2030-09-10', DateOfBirth='1982-11-04', UpdatedAt=GETDATE() WHERE Id=66; -- MFUNDO CELE
UPDATE Drivers SET IdNumber='7407185542081', LicenseExpiryDate='2029-04-22', DateOfBirth='1974-07-18', UpdatedAt=GETDATE() WHERE Id=67; -- THEMBINKOSI MASINGA
UPDATE Drivers SET IdNumber='9001017307082', LicenseExpiryDate='2030-03-07', DateOfBirth='1990-01-01', UpdatedAt=GETDATE() WHERE Id=69; -- MTHOBISI MAKHANYA
UPDATE Drivers SET IdNumber='7712256933089', LicenseExpiryDate='2031-04-10', DateOfBirth='1977-12-25', UpdatedAt=GETDATE() WHERE Id=70; -- SCELO NDOVELA
UPDATE Drivers SET IdNumber='9306205501085', LicenseExpiryDate='2030-10-08', DateOfBirth='1993-06-20', UpdatedAt=GETDATE() WHERE Id=49; -- NJABULO MAKHANYA
UPDATE Drivers SET IdNumber='9209275844080', LicenseExpiryDate='2031-02-09', DateOfBirth='1992-09-27', UpdatedAt=GETDATE() WHERE Id=76; -- AYANDA MSOMI
UPDATE Drivers SET IdNumber='8101145792089', LicenseExpiryDate='2027-03-31', DateOfBirth='1981-01-14', UpdatedAt=GETDATE() WHERE Id=77; -- GOODMAN GUMBI
UPDATE Drivers SET IdNumber='7312065350086', LicenseExpiryDate='2031-05-08', DateOfBirth='1973-12-06', Status='Active', UpdatedAt=GETDATE() WHERE Id=47; -- PATRIC KHANYILE (activate)
UPDATE Drivers SET LastName='MWAUZIWANA', LicenseType='EC Code 14', LicenseExpiryDate='2029-10-08', DateOfBirth='1982-08-02', Status='Active', UpdatedAt=GETDATE() WHERE Id=48; -- MIKE (DOB from list; no SA ID given)

-- ---------- Placeholder rows promoted to real drivers -------------------------
UPDATE Drivers SET FirstName='M', LastName='NGUBANE', IdNumber='8702025516082', LicenseType='C1 Code 10', LicenseExpiryDate='2030-06-05', DateOfBirth='1987-02-02', Status='Active', UpdatedAt=GETDATE() WHERE Id=24;
UPDATE Drivers SET FirstName='MTHOKOZISI', LastName='MZILA', IdNumber='8305235461089', LicenseType='C1 Code 10', LicenseExpiryDate='2030-02-14', DateOfBirth='1983-05-23', Status='Active', UpdatedAt=GETDATE() WHERE Id=25;
UPDATE Drivers SET FirstName='SIHLE', LastName='KHUZWAYO', IdNumber='7809045832083', LicenseType='EC Code 14', LicenseExpiryDate='2030-06-30', DateOfBirth='1978-09-04', Status='Active', UpdatedAt=GETDATE() WHERE Id=28;
UPDATE Drivers SET FirstName='MZUVUKILE', LastName='JIM', IdNumber='9306175569088', LicenseType='EC Code 14', LicenseExpiryDate='2031-05-22', DateOfBirth='1993-06-17', Status='Active', UpdatedAt=GETDATE() WHERE Id=30;
UPDATE Drivers SET FirstName='SIYABONGA', LastName='MABENA', IdNumber='8007215293082', LicenseType='C1 Code 10', LicenseExpiryDate='2030-02-10', DateOfBirth='1980-07-21', Status='Active', UpdatedAt=GETDATE() WHERE Id=11;
UPDATE Drivers SET LastName='CELE', IdNumber='7703245017084', LicenseType='EC Code 14', LicenseExpiryDate='2030-03-04', DateOfBirth='1977-03-24', Status='Active', UpdatedAt=GETDATE() WHERE Id=81; -- THULANI
UPDATE Drivers SET FirstName='SBONGISENI', LastName='MAKHANYA', IdNumber='9103095426089', LicenseType='C1 Code 10', LicenseExpiryDate='2030-03-13', DateOfBirth='1991-03-09', Status='Active', UpdatedAt=GETDATE() WHERE Id=79;
UPDATE Drivers SET LastName='BHULOSE', IdNumber='8101155313081', LicenseType='C1 Code 10', LicenseExpiryDate='2030-09-10', DateOfBirth='1981-01-15', Status='Active', UpdatedAt=GETDATE() WHERE Id=80; -- SIKHUMBUZO
UPDATE Drivers SET FirstName='NKOSIPHENDULO', LastName='MADIKIZELA', IdNumber='7808056083084', LicenseType='C1 Code 10', LicenseExpiryDate='2031-07-17', DateOfBirth='1978-08-05', Status='Active', UpdatedAt=GETDATE() WHERE Id=83;

-- ---------- New drivers --------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='8108105495082')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, CreatedAt)
VALUES ('MTHOKOZISI','MADONSELA','8108105495082','EC Code 14','2030-06-06','8108105495082','1981-08-10','Active',GETDATE());

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='7912305380080')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, HireDate, CreatedAt)
VALUES ('VUSIMUZI','DLAMINI','7912305380080','EC Code 14','2029-10-19','7912305380080','1979-12-30','Active','2026-09-29',GETDATE()); -- new, started 29 Sept

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='6212305807088')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, CreatedAt)
VALUES ('BHEKI VUSUMUZI','COSHIBE','6212305807088','EC Code 14','2030-09-01','6212305807088','1962-12-30','Active',GETDATE());

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='8206176152085')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, HireDate, CreatedAt)
VALUES ('NKOSI','GASA','8206176152085','EC Code 14','2031-08-05','8206176152085','1982-06-17','Active','2026-09-01',GETDATE()); -- new Sept

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='7901225738089')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, HireDate, CreatedAt)
VALUES ('BHEKIZITHA','MKHIZE','7901225738089','C1 Code 10','2030-08-12','7901225738089','1979-01-22','Active','2026-09-01',GETDATE()); -- new Sept

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='9106166386082')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, CreatedAt)
VALUES ('NKULULEKO','MAPHUMULO','9106166386082','C1 Code 10','2029-10-02','9106166386082','1991-06-16','Active',GETDATE());

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='8512236311086')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, CreatedAt)
VALUES ('WISEMAN','KHUZWAYO','8512236311086','EC Code 14','2031-04-28','8512236311086','1985-12-23','Active',GETDATE());

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE IdNumber='8707046301083')
INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, IdNumber, DateOfBirth, Status, CreatedAt)
VALUES ('MPENDULO','MHLONGO','8707046301083','C1 Code 10','2029-01-01','8707046301083','1987-07-04','Active',GETDATE());

-- ---------- Vehicle links (only unambiguous region+type matches) ---------------
UPDATE Vehicles SET CurrentDriverId=43, UpdatedAt=GETDATE() WHERE Id=45;  -- BF87WWZN EC TRANSIT   -> MLONDI NKOMO (PE Transit)
UPDATE Vehicles SET CurrentDriverId=63, UpdatedAt=GETDATE() WHERE Id=138; -- BK41MSZN WC NP200     -> DERICK MANGOPE (CT np200)
UPDATE Vehicles SET CurrentDriverId=66, UpdatedAt=GETDATE() WHERE Id=16;  -- BB59LZZN GP 14 TON    -> MFUNDO CELE (JHB 14-ton; replaces placeholder link)
UPDATE Vehicles SET CurrentDriverId=45, UpdatedAt=GETDATE() WHERE Id=31;  -- BK31HNZN PE 8 TON     -> MFANAFUTHI NGCOBO (PE 8-ton; replaces placeholder link)
-- Vehicle 34 (LP65PGGP CPT TRANSIT) already points at driver 30, now MZUVUKILE JIM. No change needed.

PRINT 'Driver master update complete.';
GO
