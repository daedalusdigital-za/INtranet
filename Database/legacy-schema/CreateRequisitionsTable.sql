-- =============================================================
-- Requisitions / Petty Cash (Rocket Freight Requisition Forms)
-- Creates the table (idempotent) and seeds June & July 2026 data.
-- =============================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Requisitions')
BEGIN
    CREATE TABLE [Requisitions] (
        [Id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [RfNumber]        NVARCHAR(50)      NULL,
        [Date]            DATETIME2         NULL,
        [PaidTo]          NVARCHAR(200)     NULL,
        [CellNumber]      NVARCHAR(100)     NULL,
        [AmountEwallet]   DECIMAL(18,2)     NOT NULL DEFAULT (0),
        [Reason]          NVARCHAR(1000)    NULL,
        [DieselAmount]    DECIMAL(18,2)     NOT NULL DEFAULT (0),
        [Status]          NVARCHAR(20)      NOT NULL DEFAULT ('Active'),
        [PaymentMethod]   NVARCHAR(50)      NULL,
        [PeriodYear]      INT               NOT NULL DEFAULT (0),
        [PeriodMonth]     INT               NOT NULL DEFAULT (0),
        [CreatedByUserId] INT               NULL,
        [CreatedAt]       DATETIME2         NOT NULL DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt]       DATETIME2         NULL
    );

    CREATE INDEX [IX_Requisitions_Period] ON [Requisitions] ([PeriodYear], [PeriodMonth]);
    CREATE INDEX [IX_Requisitions_Status] ON [Requisitions] ([Status]);
    PRINT 'Created table Requisitions.';
END
ELSE
    PRINT 'Table Requisitions already exists.';

-- Seed only once (when empty) so re-running is safe.
IF NOT EXISTS (SELECT 1 FROM [Requisitions])
BEGIN
    ------------------------------------------------------------------
    -- JUNE 2026
    ------------------------------------------------------------------
    INSERT INTO [Requisitions]
        ([RfNumber],[Date],[PaidTo],[CellNumber],[AmountEwallet],[Reason],[DieselAmount],[Status],[PaymentMethod],[PeriodYear],[PeriodMonth])
    VALUES
    ('488','2026-06-03','DUMI','0813277580',250.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,6),
    ('489','2026-06-08','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,6),
    ('490','2026-06-08','MABASO','0699931132',4000.00,'PE DIESEL R 1000 AND POWER R 3000',1000.00,'Active','E-Wallet',2026,6),
    ('491','2026-06-08','DOCTOR','0835171836',500.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,6),
    ('492','2026-06-09','DEON AND VINODH','0725953067',400.00,'MEAL ALLOWANCE TRAVEL TO GP',0,'Active','E-Wallet',2026,6),
    ('493','2026-06-10','SITHOBE','0769279714',1000.00,'CAPE TOWN HYSTER DIESEL',1000.00,'Active','E-Wallet',2026,6),
    ('494','2026-06-11','DUMI','0813277580',250.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,6),
    ('495','2026-06-11','VINODH','0725953067',2700.00,'SLEEP OUT GP TO PE TO CT TO DBN',0,'Active','E-Wallet',2026,6),
    ('496','2026-06-11','MLONDI KWHELA',NULL,0.00,'COMPASSION - MOTHER PASSED AWAY',0,'Active','Bank Transfer',2026,6),
    ('497','2026-06-12','DEON','0671659450',198.00,'REFUND - HAND RIVET GUN (BRONKHORST SPRUIT)',0,'Active','E-Wallet',2026,6),
    ('498','2026-06-12','SHAUN',NULL,1690.00,'GEARBOX OIL/TRANSMISSION',0,'Active','E-Wallet',2026,6),
    ('499','2026-06-15','DOCTOR','0835171836',1200.00,'SLEEP OUT DBN/CT/GP X3 AT R150 X8',0,'Active','E-Wallet',2026,6),
    ('500',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,6),
    ('301',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,6),
    ('302','2026-06-15','PATRICK','0792296949',450.00,'SLEEP OUT DBN/GP/KZN R150X3',0,'Active','E-Wallet',2026,6),
    ('303','2026-06-15','DEON','0671659450',600.00,'CASH WAGES WORKERS TO OFFLOAD R 150 X4',0,'Active','E-Wallet',2026,6),
    ('304','2026-06-17','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,6),
    ('305','2026-06-17','BUHLE','0789204936',600.00,'SLEEP OUT 600.00',0,'Active','E-Wallet',2026,6),
    (NULL,'2026-06-17','NGUBANE','0662498540',300.00,'SLEEP OUT',0,'Active','E-Wallet',2026,6),
    ('306','2026-06-17','MASIYA','0614629814',600.00,'MEAL ALLOWANCE TRAVEL TO CPT 150X4',0,'Active','E-Wallet',2026,6),
    ('307','2026-06-18','DUMI','0813277580',2100.00,'SLEEP OUT DBN/GP/KZN 150X14',0,'Active','E-Wallet',2026,6),
    ('308',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,6),
    ('309','2026-06-18','COLLETTE',NULL,0.00,'REFUND - PAID ACCOMMODATION FOR VINODH AND MFUNDI TRUCK STOP',0,'Active','Bank Transfer',2026,6),
    ('310',NULL,'DEVAN MOODLEY',NULL,0.00,'LOAN - STAFF - MR ZONDI APPROVED',0,'Active','Bank Transfer',2026,6),
    ('311',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,6),
    ('312','2026-06-19','DUMI','0813277580',250.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,6),
    ('313','2026-06-19','SHAUN','0685229597',1500.00,'FUEL FOR WEEKEND - LOAN VEHICLE FROM FORD',1500.00,'Active','E-Wallet',2026,6),
    ('314','2026-06-22','MABASO','0699931132',3000.00,'PE POWER R 3000',0,'Active','E-Wallet',2026,6),
    ('315','2026-06-22','SITHOBE','0769279714',1000.00,'CAPE TOWN HYSTER DIESEL',1000.00,'Active','E-Wallet',2026,6),
    ('316','2026-06-23','VINODH','0725953067',400.00,'REFUND BREAKDOWN BH30XNZN',0,'Active','E-Wallet',2026,6),
    ('317','2026-06-23','SHERRIF OF COURT','0824562285',4000.00,'LEGAL FEES',0,'Active','E-Wallet',2026,6),
    ('318','2026-06-23','MJ DU TOIT',NULL,0.00,'SETTLEMENT AGREEMENT',0,'Active','Bank Transfer',2026,6),
    ('319','2026-06-24','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,6),
    ('320','2026-06-24','DEVAN MOODLEY','0721695750',1500.00,'FUEL ALLOWANCE',1500.00,'Active','E-Wallet',2026,6),
    ('321',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,6),
    ('322','2026-06-24','VINODH','0725953067',1000.00,'EMERGENCY BREAKDOWN - BUHLE',0,'Active','E-Wallet',2026,6),
    ('323','2026-06-26','SYDNEY',NULL,5000.00,'RELOCATION TO VERULAM',0,'Active','Bank Transfer',2026,6),
    ('324','2026-06-29','KZN CASUALS''DEVAN','0721695750',600.00,'4 X R150 PER CASUAL TO OFFLOAD CONTAINER',0,'Active','E-Wallet',2026,6);

    ------------------------------------------------------------------
    -- JULY 2026
    ------------------------------------------------------------------
    INSERT INTO [Requisitions]
        ([RfNumber],[Date],[PaidTo],[CellNumber],[AmountEwallet],[Reason],[DieselAmount],[Status],[PaymentMethod],[PeriodYear],[PeriodMonth])
    VALUES
    ('325','2026-07-01','MABASO','06999931132',4000.00,'PE POWER - R 3000, HYSTER DIESEL - R 1000',1000.00,'Active','E-Wallet',2026,7),
    ('326','2026-07-01','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,7),
    ('327','2026-07-02','DOCTOR','0835171836',500.00,'2 X R250 - PE SECURITY ESCOURT',0,'Active','E-Wallet',2026,7),
    ('329','2026-07-03','KULULEKO','0697538769',600.00,'SLEEP OUT 300X2',0,'Active','E-Wallet',2026,7),
    ('329','2026-07-03','BUHLE','0789204936',900.00,'SLEEP OUT 300X3',0,'Active','E-Wallet',2026,7),
    ('330','2026-07-03','DOCTOR','0835171836',3150.00,'SLEEP OUT 150 X 21',0,'Active','E-Wallet',2026,7),
    ('331','2026-07-03','DUMI','0813277580',1500.00,'SLEEP OUT 150X10',0,'Active','E-Wallet',2026,7),
    ('332','2026-07-03','PATRICK','0792296949',1200.00,'SLEEP OUT 150X8',0,'Active','E-Wallet',2026,7),
    ('333','2026-07-03','TRISHEN','0768122848',1300.00,'CPT NP200 FUEL',1300.00,'Active','E-Wallet',2026,7),
    ('334','2026-07-06','MASIYA','0614629814',300.00,'CROSS BORDER MEAL ALLOWANCE',0,'Active','E-Wallet',2026,7),
    ('335','2026-07-06','DOCTOR','0835171836',1100.00,'FUEL',1100.00,'Active','E-Wallet',2026,7),
    ('336',NULL,NULL,NULL,0.00,'CANCELLED',0,'Cancelled',NULL,2026,7),
    ('337','2026-07-07','C MASINGA',NULL,5000.00,'FUNERAL',0,'Active','Bank Transfer',2026,7),
    ('338','2026-07-16','MABASO','0699931132',4000.00,'PE POWER - R 3000, HYSTER DIESEL - R 1000',1000.00,'Active','E-Wallet',2026,7),
    ('339','2026-07-16','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,7),
    ('340','2026-07-16','NEERAN','0843604532',1500.00,'CPT HYSTER DIESEL',1500.00,'Active','E-Wallet',2026,7),
    ('341','2026-07-16','SHERRIF DEVON','0824562285',3000.00,'SHERRIF OF THE COURT / MR ZONDI',0,'Active','E-Wallet',2026,7),
    ('342','2026-07-17','TSHIDISO','0691539114',1520.00,'REFUND FOR LOCKNUT BMW',0,'Active','E-Wallet',2026,7),
    ('343','2026-07-21','TSHIDISO','0691539114',600.00,'SLEEP OUT ALLOWANCE / MR ZONDI',0,'Active','E-Wallet',2026,7),
    ('344','2026-07-21','JULIUS','0620843160',700.00,'MEAL ALLOWANCE CPT',0,'Active','E-Wallet',2026,7),
    ('345','2026-07-21','GOODMAN','0796524437',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('345','2026-07-21','AYANDA','0734546561',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('345','2026-07-21','VELAPHI','0784230862',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('345','2026-07-21','FRANK','0630554465',700.00,'RELOCATION FEE PE',0,'Active','E-Wallet',2026,7),
    ('346','2026-07-21','JABULO','0737527442',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('348','2026-07-24','MASIYA','0614629814',1700.00,'CROSS BORDER MEAL ALLOWANCE',0,'Active','E-Wallet',2026,7),
    ('349','2026-07-24','ZUNGU','0760491860',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','SBONGISENI','0832381289',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','MPENDULO','0657051513',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','WISEMAN','0606272052',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','NKOSIPHENDULO','0839605846',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','NKULULENO','0762715444',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('350','2026-07-27','GOODMAN','0796524436',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('351','2026-07-27','SIKHUMBIZO','0725005104',700.00,'RELOCATION FEE CT',0,'Active','E-Wallet',2026,7),
    ('351','2026-07-27','MTOKOZISI','0720878826',700.00,'RELOCATION FEE CT',0,'Active','E-Wallet',2026,7),
    ('352','2026-07-27','VINODH','0725953067',300.00,'MEAL ALLOWANCE',0,'Active','E-Wallet',2026,7),
    ('353','2026-07-27','ZUNGU','0760491860',700.00,'RELOCATION FEE GP',0,'Active','E-Wallet',2026,7),
    ('354','2026-07-27','NAZRETH','0683046477',189.00,'WATER LEVEL REFUND',0,'Active','E-Wallet',2026,7),
    ('355','2026-07-29','MIKE','0767641675',250.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,7),
    ('355','2026-07-29','DEON','0671659450',4000.00,'KZN HYSTER DIESEL',4000.00,'Active','E-Wallet',2026,7),
    ('356','2026-07-31','MORRIS','0829544817',250.00,'SECURITY ESCOURT',0,'Active','E-Wallet',2026,7),
    ('357','2026-07-31','MABASO','0699931132',4000.00,'PE POWER - R 3000, HYSTER DIESEL - R 1000',1000.00,'Active','E-Wallet',2026,7),
    ('358','2026-07-31','MASIYA','0614629814',2100.00,'CROSS BORDER TOLLS, MEAL, FEES',0,'Active','E-Wallet',2026,7);

    PRINT 'Seeded June & July 2026 requisitions.';
END
ELSE
    PRINT 'Requisitions already contains data - seed skipped.';
