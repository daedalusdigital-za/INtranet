-- =====================================================
-- Seed Tender Schedule Data (March 2026)
-- 42 Tenders from the Tender Schedule spreadsheet
-- =====================================================
USE ProjectTrackerDB;
GO

-- Only insert if table is empty (avoid duplicates)
IF (SELECT COUNT(*) FROM Tenders) = 0
BEGIN
    PRINT 'Seeding 42 tenders from the Tender Schedule...';
    
    SET IDENTITY_INSERT Tenders ON;

    -- Company Code Mapping:
    -- SHARPEYE  -> SEY
    -- SEBENZANI -> SBT
    -- PROMED    -> PMT
    -- JV        -> JVT
    -- SA WELLNESS -> SAW
    -- PHARMACARE -> PHC
    -- PHARMATECH -> PHT
    -- ACCESS    -> ACM
    -- PROMED/SEBENZANI -> PMT (primary)

    INSERT INTO Tenders (Id, TenderNumber, Title, Description, IssuingDepartment, DepartmentCategory, Province, ContactPerson, CompanyCode, ClosingDate, CompulsoryBriefingDate, BriefingVenue, Status, WorkflowStatus, Priority, CreatedByUserId, CreatedAt)
    VALUES
    -- 1. Mossel Bay Municipality - Security
    (1, N'TDR114/2025/2026', 
     N'Rendering of Security Services to the Mossel Bay Municipality', 
     N'RENDERING OF SECURITY SERVICES TO THE MOSSEL BAY MUNICIPALITY',
     N'Mossel Bay Municipality', N'Municipality', N'WC', N'Hlengiwe', N'SEY',
     '2026-02-27', NULL, NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 2. Dube Tradeport - Security (3 years)
    (2, N'DTP/RFP/16/PRO/10/2025', 
     N'Provision for Security Services for Dube Tradeport Corporation (3 years)', 
     N'Provision for Security Services for Dube Tradeport Corporation for a period of three (3) years',
     N'Dube Tradeport', N'State Owned Entity', N'KZN', N'Hlengiwe', N'SEY',
     '2026-02-27', '2026-01-23', NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 3. PRASA KZN - Hygiene Services (36 months)
    (3, N'KZN/PRASA/2026/02/10/Q', 
     N'Hygiene Services for PRASA Rail Stations & Depots KZN (36 months)', 
     N'REQUEST FOR QUOTATION (RFQ) FOR THE APPOINTMENT OF A COMPETENT AND EXPERIENCED HYGIENE SERVICE PROVIDER TO RENDER STANDARDIZED HYGIENE SERVICES ON A MONTHLY BASIS OVER A CONTRACT PERIOD OF THIRTY-SIX (36) MONTHS FOR ALL PRASA RAIL STATIONS AND DEPOTS WITHIN THE KWAZULU-NATAL REGION.',
     N'Passenger Rail Agency of South Africa', N'State Owned Entity', N'KZN', N'Hlengiwe', N'SEY',
     '2026-02-27', '2026-02-19', NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 4. CATHSSETA - Security Services (46 months)
    (4, N'CATHS/SS/11/2025', 
     N'Provision of Security Services for CATHSSETA (46 months)', 
     N'PROVISION OF SECURITY SERVICES FOR A PERIOD OF FOURTY-SIX (46) MONTHS',
     N'Culture Arts, Tourism, Hospitality And Sport Sector Education And Training Authority (CATHSSETA)', N'SETA', NULL, N'Hlengiwe', N'SEY',
     '2026-03-02', NULL, NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 5. Rand West - Cleaning Material & Equipment (36 months)
    (5, N'RWCLM-2/002/2025-2026', 
     N'Supply & Delivery of Cleaning Material and Equipment (36 months)', 
     N'Appointment of a panel of one to ten (1-10) service providers to supply and deliver cleaning material and equipment for a period of 36 months on as and when required.',
     N'Rand West Local Municipality', N'Municipality', N'GP', N'Abby', N'SBT',
     '2026-03-02', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 6. KZN Community Safety - Cleaning Services (36 months)
    (6, N'DCSL SBD 22-2026', 
     N'Cleaning Services for KZN Community Safety & Liaison (36 months)', 
     N'DCSL SBD 22-2026 APPOINTMENT OF A PANEL OF SERVICE PROVIDERS TO RENDER CLEANING SERVICES TO THE DEPARTMENT FOR A PERIOD OF 36 MONTHS',
     N'KwaZulu-Natal Community Safety and Liaison', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-02', '2026-02-12', NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 7. NRF - Toilet Paper & Towels (36 months)
    (7, N'NRF/CORP EM RFQ 125/2025-26b', 
     N'Supply & Delivery of Toilet Paper and Hand Towels to NRF (36 months)', 
     N'THE APPOINTMENT OF A SERVICE PROVIDER TO SUPPLY AND DELIVER 1PLY TOILET PAPER, FOLDED HAND PAPER TOWEL, AND BARREL PAPER TOWEL TO THE NATIONAL RESEARCH FOUNDATION HEAD OFFICE FOR A PERIOD OF THIRTY-SIX MONTHS',
     N'National Research Foundation', N'State Owned Entity', NULL, N'Sphindile', N'PMT',
     '2026-03-02', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 8. SITA / WC Education - Online App (5 years)
    (8, N'RFP 3209/2025', 
     N'Online Mathematics Application for 500 Schools Grades 3-7 (5 years)', 
     N'Request for Proposal for the Appointment of a Service Provider to Provide a Service of an Online Application in Afrikaans, English, and Isixhosa, in a Cohort of 500 Schools From Grades 3-7, with Digitally Administered Online Mathematics Exercises and Assessments on an Annual Basis for a 5-Year Period for Western Cape Government: Department of Education',
     N'State Information Technology Agency', N'State Owned Entity', N'WC', N'Abby', N'JVT',
     '2026-03-03', '2026-02-16', N'Online', 
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 9. NDSO - Medical Products
    (9, N'NSDO/MED/2026/01', 
     N'Supply and Delivery of Medical Products', 
     N'SUPPLY AND DELIVERY OF MEDICAL PRODUCTS',
     N'NDSO', N'National Government', NULL, N'Abby', N'PMT',
     '2026-03-05', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 10. KZN EDTEA - Cleaning Richards Bay (36 months)
    (10, N'ZNT 14 EDTEA 25/26', 
     N'Cleaning Services at King Cetshwayo District Richards Bay (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER TO PROVIDE CLEANING SERVICES AT KING CETSHWAYO DISTRICT (RICHARDS BAY OFFICE) FOR THE DEPARTMENT OF ECONOMIC DEVELOPMENT, TOURISM AND ENVIRONMENTAL AFFAIRS FOR A PERIOD OF 36 MONTHS',
     N'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-06', '2026-02-11', NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 11. Nkomazi Zone 1 - Security (36 months)
    (11, N'NKO: 01/2026', 
     N'Security Services at Zone 1 Facilities Nkomazi Municipality (36 months)', 
     N'INVITATION FOR SERVICE PROVIDERS TO BID FOR THE PROVISION OF SECURITY SERVICES AT ZONE ONE (1) FACILITIES FOR THE NKOMAZI LOCAL MUNICIPALITY FOR A PERIOD OF THIRTY SIX (36) MONTHS',
     N'Nkomazi Local Municipality', N'Municipality', N'MP', N'Hlengiwe', N'SEY',
     '2026-03-06', '2026-02-12', NULL,
     'Submitted', 'Submission Ready', 'High', 1, GETUTCDATE()),

    -- 12. KZN EDTEA - Cleaning Umtubatuba (36 months)
    (12, N'ZNT 26 EDTEA 25-26', 
     N'Cleaning Services at Umtubatuba District Office (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER TO PROVIDE CLEANING SERVICES AT UMTUBATUBA DISTRICT OFFICE FOR THE DEPARTMENT OF ECONOMIC DEVELOPMENT, TOURISM AND ENVIRONMENTAL AFFAIRS FOR A PERIOD OF 36 MONTHS.',
     N'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-04', '2026-02-10', NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 13. Drakenstein - Toilet Paper & Towels (to June 2029)
    (13, N'PROC 2/2026', 
     N'Supply & Delivery of Toilet Paper and Hand Paper Towels (to June 2029)', 
     N'SUPPLY AND DELIVERY OF TOILET PAPER AND HAND PAPER TOWELS FOR A PERIOD UP TO 30 JUNE 2029',
     N'Drakenstein Municipality', N'Municipality', N'WC', N'Sphindile', N'PMT',
     '2026-03-05', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 14. Drakenstein - PPE & Clothing (to June 2029)
    (14, N'PROC 1/2026', 
     N'Supply & Delivery of PPE and Clothing (to June 2029)', 
     N'SUPPLY AND DELIVERY OF PERSONAL PROTECTIVE EQUIPMENT AND CLOTHING FOR A PERIOD UP TO 30 JUNE 2029',
     N'Drakenstein Municipality', N'Municipality', N'WC', N'Sphindile', N'SBT',
     '2026-03-05', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 15. Drakenstein - Copy Paper (to June 2029)
    (15, N'PROC 3/2026', 
     N'Supply & Delivery of Copy Paper (to June 2029)', 
     N'SUPPLY AND DELIVERY OF COPY PAPER FOR A PERIOD UP TO 30 JUNE 2029',
     N'Drakenstein Municipality', N'Municipality', N'WC', N'Sphindile', N'SBT',
     '2026-03-05', NULL, NULL,
     'Submitted', 'Submission Ready', 'Medium', 1, GETUTCDATE()),

    -- 16. Labour FS Central Cluster - Security (36 months)
    (16, N'FSDEL02/2026', 
     N'Security Service for Labour FS Central Cluster Offices (36 months)', 
     N'Rendering of a Security Service for period of 36 months at the following offices (Central Cluster): Botshabelo Labour Centre, Bloemfontein Labour Centre, Zastron Labour Centre, Petrusburg Labour Centre',
     N'Department of Employment and Labour', N'National Government', N'FS', N'Hlengiwe', N'SEY',
     '2026-03-09', '2026-03-05', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 17. Labour FS Provincial Office - Security (36 months)
    (17, N'FSDEL01/2026', 
     N'Security Service for Labour FS Provincial Office Bloemfontein (36 months)', 
     N'Rendering of a Security Service for period of 36 months at the following offices: Provincial Office: Bloemfontein',
     N'Department of Employment and Labour', N'National Government', N'FS', N'Hlengiwe', N'SEY',
     '2026-03-09', '2026-03-05', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 18. KZN Health - Smart Lockers (3 year subscription)
    (18, N'ZNB 5147/2025-H', 
     N'Smart Lockers for Prepacked Chronic Medicines (3 year subscription)', 
     N'SUPPLY, DELIVERY, INSTALLATION AND TESTING OF SMART LOCKERS, SUPPORT FOR PREPACKED CHRONIC MEDICINES TO BE DISPENSED FOR CLIENTS AT VARIOUS INSTITUTIONS INCLUDING THREE YEAR SUBSCRIPTION',
     N'KwaZulu-Natal Department of Health', N'Health', N'KZN', N'Abby', N'SAW',
     '2026-03-09', '2026-02-18', N'Online',
     'Draft', 'Review', 'Critical', 1, GETUTCDATE()),

    -- 19. Nkomazi Zone 2 - Security (36 months)
    (19, N'NKO: 02/2026', 
     N'Security Services at Zone 2 Facilities Nkomazi Municipality (36 months)', 
     N'INVITATION FOR SERVICE PROVIDERS TO BID FOR THE PROVISION OF SECURITY SERVICES AT ZONE TWO (2) FACILITIES FOR THE NKOMAZI LOCAL MUNICIPALITY FOR A PERIOD OF THIRTY SIX (36) MONTHS',
     N'Nkomazi Local Municipality', N'Municipality', N'MP', N'Hlengiwe', N'SEY',
     '2026-03-10', '2026-02-12', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 20. NW Health - Security (48 months)
    (20, N'NWDOH 08/2026', 
     N'Physical Security Services for NW Department of Health (48 months)', 
     N'Rendering of Physical Security Services for the North West Department of Health (NWDOH) for a period of Forty Eight (48) months',
     N'North West Department of Health', N'Health', N'NW', N'Hlengiwe', N'SEY',
     '2026-03-10', NULL, NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 21. Mbizana - Cannabis Equipment
    (21, N'WMM LM 13/02/26/02 CDP', 
     N'Supply and Delivery of Equipment for Cannabis Development Program', 
     N'Supply and Delivery of Equipment and material for Cannabis Development Program',
     N'Mbizana Local Municipality', N'Municipality', N'EC', N'Sphindile', N'PMT',
     '2026-03-10', NULL, NULL,
     'Draft', 'Review', 'Medium', 1, GETUTCDATE()),

    -- 22. KZN COGTA - Cleaning & Gardening (36 months)
    (22, N'ZNT 2066/2025LG', 
     N'Cleaning, Gardening & Hygiene for 14 COGTA Buildings (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER/S TO RENDER CLEANING, GARDENING AND HYGIENE SERVICES ON A CONTRACTUAL BASIS FOR A PERIOD OF 36 MONTHS TO 14 COGTA BUILDINGS',
     N'KwaZulu-Natal Cooperative Governance and Traditional Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-10', NULL, NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 23. Nkangala District - Cleaning (36 months, re-advert)
    (23, N'51655', 
     N'Cleaning Services for Nkangala District Municipality (36 months, re-advert)', 
     N'RENDERING OF CLEANING SERVICES FOR NKANGALA DISTRICT MUNICIPALITY OFFICES / BUILDINGS FOR A PERIOD OF 36 MONTHS (RE-ADVERT)',
     N'Nkangala District Municipality', N'Municipality', N'MP', N'Hlengiwe', N'SEY',
     '2026-03-10', '2026-02-13', NULL,
     'Draft', 'Review', 'Medium', 1, GETUTCDATE()),

    -- 24. Labour FS Bethlehem cluster - Security (36 months)
    (24, N'FSDEL04/2026', 
     N'Security Service for Labour FS Bethlehem/Harrismith Cluster (36 months)', 
     N'RENDERING OF SECURITY SERVICE FOR A PERIOD OF 36 MONTHS AT THE FOLLOWING OFFICES: BETHLEHEM LABOUR CENTRE, FICKSBURG LABOUR CENTRE, HARRISMITH LABOUR CENTRE, PHUTHADITJHABA LABOUR CENTRE',
     N'Department of Employment and Labour', N'National Government', N'FS', N'Hlengiwe', N'SEY',
     '2026-03-11', '2026-03-05', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 25. Labour FS Kroonstad cluster - Security (36 months)
    (25, N'FSDEL03/2026', 
     N'Security Service for Labour FS Kroonstad/Welkom Cluster (36 months)', 
     N'RENDERING OF SECURITY SERVICES FOR A PERIOD OF 36 MONTHS AT THE FOLLOWING OFFICES: 1.KROONSTAD LABOUR CENTRE 2.WELKOM LABOUR CENTRE 3.SASOLBURG LABOUR CENTRE 4.PARYS SATELLITE OFFICE',
     N'Department of Employment and Labour', N'National Government', N'FS', N'Hlengiwe', N'SEY',
     '2026-03-11', '2026-03-05', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 26. Freedom Park - Security (3 years)
    (26, N'FP 06/2025 CS', 
     N'Security Services at Freedom Park (3 years)', 
     N'Appointment of a service provider for the provision of security services at Freedom Park for a period of three years',
     N'Freedom Park Trust', N'State Owned Entity', N'GP', N'Hlengiwe', N'SEY',
     '2026-03-11', '2026-02-25', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 27. Umgeni Water - Head Office Cleaning (5 years)
    (27, N'2025/011(A)', 
     N'Head Office Cleaning Contract for Umgeni Water (5 years)', 
     N'HEAD OFFICE CLEANING CONTRACT FOR FIVE (5) YEARS',
     N'Umgeni Water', N'State Owned Entity', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-12', '2026-02-24', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 28. NW Treasury - Cleaning Chemicals (3 years)
    (28, N'NWP 002/25', 
     N'Transversal Supply & Delivery of Cleaning Chemicals NW Province (3 years)', 
     N'TRANSVERSAL CONTRACT FOR SUPPLY AND DELIVERY OF CLEANING CHEMICALS TO NORTH WEST PROVINCIAL GOVERNMENT FOR A PERIOD OF THREE (03) YEARS',
     N'North West Provincial Treasury', N'Provincial Government', N'NW', N'Abby', N'SBT',
     '2026-03-12', '2026-03-04', NULL,
     'Draft', 'Review', 'Medium', 1, GETUTCDATE()),

    -- 29. Labour MP - Security Provincial Office (36 months)
    (29, N'LMP04/2026', 
     N'Physical Security for Labour Mpumalanga Provincial Office (36 months)', 
     N'Appointment of service provider to render Physical Security Services for Department of Employment and Labour at Mpumalanga Provincial Office for a period of 36 Months',
     N'Department of Employment and Labour', N'National Government', N'MP', N'Hlengiwe', N'SEY',
     '2026-03-13', '2026-02-18', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 30. WC Health - George Hospital Cleaning (3 years)
    (30, N'WCGHSC0448/1/2025', 
     N'Comprehensive Cleaning Service for George Hospital (3 years)', 
     N'RENDERING OF A COMPREHENSIVE CLEANING SERVICE TO GEORGE HOSPITAL FOR A PERIOD OF THREE (3) YEARS UNDER THE CONTROL OF THE WESTERN CAPE GOVERNMENT HEALTH AND WELLNESS',
     N'Western Cape Department of Health', N'Health', N'WC', N'Hlengiwe', N'SEY',
     '2026-03-13', '2026-03-04', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 31. MP COGTA - Security Riverside NKP (5 years)
    (31, N'SS/077/26/MP', 
     N'Physical Security at Mpumalanga Riverside Government Complex NKP (5 years)', 
     N'PROVISION OF PHYSICAL SECURITY AT THE MPUMALANGA RIVERSIDE GOVERNMENT COMPLEX NATIONAL KEY POINT (NKP) FOR A PERIOD OF FIVE (05) YEARS',
     N'Mpumalanga Co-operative Governance, Human Settlements, and Traditional Affairs', N'Provincial Government', N'MP', N'Hlengiwe', N'SEY',
     '2026-03-13', '2026-02-23', NULL,
     'Draft', 'Review', 'Critical', 1, GETUTCDATE()),

    -- 32. SANParks - Garden Route Security (5 years)
    (32, N'GNP-108-25', 
     N'Security Guard Services at Garden Route National Park Wilderness (5 years)', 
     N'PROVISION OF SECURITY GUARD SERVICES AT THE WILDERNESS SECTION OF GARDEN ROUTE NATIONAL PARK FOR THE PERIOD OF FIVE (5) YEARS',
     N'South African National Parks', N'State Owned Entity', N'WC', N'Hlengiwe', N'SEY',
     '2026-03-13', '2026-03-03', NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 33. WC Health - Infusion Pumps & Admin Sets (3 years)
    (33, N'WCGHCC0050/2025', 
     N'Supply of Infusion Pumps and Administration Sets WC Health (3 years)', 
     N'THE SUPPLY, DELIVERY, INSTALLATION, DEMONSTRATION AND COMMISSIONING OF INFUSION PUMPS/DOCKING STATIONS AND THE PURCHASE OF COMPATIBLE ADMINISTRATION SETS FOR USE IN INSTITUTIONS IN THE WESTERN CAPE DEPARTMENT OF HEALTH FOR A PERIOD OF 3 YEARS',
     N'Western Cape Department of Health', N'Health', N'WC', N'Sphindile', N'PMT',
     '2026-03-13', NULL, NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 34. WC Health - Ophthalmology Consumables (3 years)
    (34, N'WCGHCC0043/2025', 
     N'Supply & Delivery of Ophthalmology Consumables WC Health (3 years)', 
     N'FOR THE SUPPLY AND DELIVERY OF OPHTHALMOLOGY CONSUMABLES TO ALL INSTITUTIONS UNDER THE CONTROL OF THE DEPARTMENT OF HEALTH, WESTERN CAPE GOVERNMENT HEALTH AND WELLNESS, FOR A THREE-YEAR PERIOD',
     N'Western Cape Department of Health', N'Health', N'WC', N'Sphindile', N'PMT',
     '2026-03-13', NULL, NULL,
     'Draft', 'Review', 'High', 1, GETUTCDATE()),

    -- 35. National Health - Pharmaceutical Liquids (3 years)
    (35, N'HP12-2027LQ', 
     N'Supply & Delivery of Pharmaceutical Liquids, Alcohol & Glycerine (3 years)', 
     N'HP12-2027LQ: Supply and Delivery of Pharmaceutical Liquids, Alcohol, and Glycerine to the Department of Health for the period 01 February 2027 to 31 January 2030',
     N'Department of Health', N'Health', NULL, N'Abby', N'PHC',
     '2026-03-16', '2026-01-30', NULL,
     'Draft', 'Draft', 'Critical', 1, GETUTCDATE()),

    -- 36. National Health - Large Volume Parenterals (3 years)
    (36, N'HP11-2027LVP', 
     N'Supply & Delivery of Large Volume Parenterals (3 years)', 
     N'HP11-2027LVP: Supply and Delivery of Large Volume Parenterals to the Department of Health for the period 01 February 2027 to 31 January 2030',
     N'Department of Health', N'Health', NULL, N'Abby', N'PHC',
     '2026-03-16', '2026-01-30', NULL,
     'Draft', 'Draft', 'Critical', 1, GETUTCDATE()),

    -- 37. National Health - Anti-TB Medicines
    (37, N'HP01-2025TB/01', 
     N'Supply & Delivery of Anti-Tuberculosis Medicines (to Sep 2028)', 
     N'HP01-2025TB/01: Supply and Delivery of Anti-Tuberculosis Medicines to the Department of Health for the period ending 30 September 2028',
     N'Department of Health', N'Health', NULL, N'Abby', N'PHT',
     '2026-03-16', '2026-02-20', N'Microsoft Teams',
     'Draft', 'Draft', 'Critical', 1, GETUTCDATE()),

    -- 38. EC Social Dev - Cleaning & Garden Bhisho (3 years)
    (38, N'SCMU4-25/26-0027', 
     N'Cleaning and Garden Services for EC Social Development Bhisho (3 years)', 
     N'APPOINTMENT OF SERVICE PROVIDER TO PROVIDE CLEANING AND GARDEN SERVICES WITHIN BHISHO/KWT: PROVINCIAL OFFICES, EASTERN CAPE DEPARTMENT OF SOCIAL DEVELOPMENT FOR A PERIOD OF THREE (3) YEARS',
     N'Eastern Cape Social Development and Special Programmes', N'Provincial Government', N'EC', N'Hlengiwe', N'SEY',
     '2026-03-18', NULL, NULL,
     'Draft', 'Draft', 'Medium', 1, GETUTCDATE()),

    -- 39. KZN EDTEA - Cleaning Amajuba (36 months)
    (39, N'ZNT 29 EDTEA 25/26', 
     N'Cleaning Services at Amajuba District Office EDTEA (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER TO PROVIDE CLEANING SERVICES AT AMAJUBA DISTRICT OFFICE FOR THE DEPARTMENT OF ECONOMIC DEVELOPMENT, TOURISM AND ENVIRONMENTAL AFFAIRS FOR A PERIOD OF 36 MONTHS',
     N'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-19', '2026-02-26', NULL,
     'Draft', 'Draft', 'Medium', 1, GETUTCDATE()),

    -- 40. Umzimkhulu - Security (24 months, re-advert)
    (40, N'ULM-CORP 003/25', 
     N'Security Services for Umzimkhulu Local Municipality (24 months, re-advert)', 
     N'PROVISION OF SECURITY SERVICES (24 MONTHS CONTRACT) - re-advert',
     N'Umzimkhulu Local Municipality', N'Municipality', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-20', '2026-02-19', NULL,
     'Draft', 'Draft', 'High', 1, GETUTCDATE()),

    -- 41. KZN EDTEA - Cleaning Harry Gwala (36 months)
    (41, N'ZNT 20 EDTEA 25/26', 
     N'Cleaning Services at Harry Gwala District Office EDTEA (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER TO PROVIDE CLEANING SERVICES AT HARRY GWALA DISTRICT OFFICE FOR THE DEPARTMENT OF ECONOMIC DEVELOPMENT, TOURISM AND ENVIRONMENTAL AFFAIRS FOR A PERIOD OF 36 MONTHS',
     N'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-24', '2026-03-02', NULL,
     'Draft', 'Draft', 'Medium', 1, GETUTCDATE()),

    -- 42. National Treasury - Radiographic Material (36 months)
    (42, N'RT21-2026', 
     N'Supply & Delivery of Radiographic Material and Consumables (36 months)', 
     N'Supply and delivery of Radiographic Material and Consumables to the state for the period of thirty-six (36) months',
     N'National Treasury', N'National Government', NULL, N'Abby', N'PMT',
     '2026-03-26', '2026-03-12', NULL,
     'Draft', 'Draft', 'High', 1, GETUTCDATE()),

    -- 43. KZN EDTEA - Cleaning eThekwini (36 months)
    (43, N'ZNT 24 EDTEA 25/26', 
     N'Cleaning Services at eThekwini District Office EDTEA (36 months)', 
     N'APPOINTMENT OF A SERVICE PROVIDER TO PROVIDE CLEANING SERVICES AT ETHEKWINI DISTRICT OFFICE FOR THE DEPARTMENT OF ECONOMIC DEVELOPMENT, TOURISM AND ENVIRONMENTAL AFFAIRS FOR A PERIOD OF 36 MONTHS',
     N'KwaZulu-Natal Economic Development, Tourism and Environmental Affairs', N'Provincial Government', N'KZN', N'Hlengiwe', N'SEY',
     '2026-03-30', '2026-03-04', NULL,
     'Draft', 'Draft', 'Medium', 1, GETUTCDATE());

    SET IDENTITY_INSERT Tenders OFF;

    -- Also insert activities for each tender (creation log)
    INSERT INTO TenderActivities (TenderId, ActivityType, Description, UserId, UserName, CreatedAt)
    SELECT Id, 'Created', 'Tender created from schedule import', 1, 'System Import', GETUTCDATE()
    FROM Tenders;

    PRINT 'Tender schedule seeded successfully.';
END
ELSE
BEGIN
    PRINT 'Tenders table already has data. Skipping seed.';
END
GO
