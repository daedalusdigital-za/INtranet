-- Seed Company Sales Data for Sales Dashboard
-- From January 5, 2026 to January 22, 2026 (weekdays only)
-- ~R1 Million per day per company (PMT, ACM, PHT, SBT)

-- Customer names for variety
DECLARE @Customers TABLE (Id INT IDENTITY(1,1), CustomerNumber NVARCHAR(50), CustomerName NVARCHAR(200), Province NVARCHAR(50));
INSERT INTO @Customers VALUES
('01-MED-001', 'Medstar General Hospital', 'Gauteng'),
('01-MED-002', 'City Medical Centre', 'Gauteng'),
('01-MED-003', 'Sandton Healthcare', 'Gauteng'),
('01-GJC-001', 'G.J Crookes Hospital', 'KwaZulu-Natal'),
('01-KZN-001', 'Durban Regional Hospital', 'KwaZulu-Natal'),
('01-KZN-002', 'Pietermaritzburg Medical', 'KwaZulu-Natal'),
('01-WC-001', 'Cape Town General', 'Western Cape'),
('01-WC-002', 'Stellenbosch Clinic', 'Western Cape'),
('01-EC-001', 'Port Elizabeth Hospital', 'Eastern Cape'),
('01-EC-002', 'East London Medical', 'Eastern Cape'),
('01-FS-001', 'Bloemfontein Central', 'Free State'),
('01-LP-001', 'Polokwane Regional', 'Limpopo'),
('01-MP-001', 'Nelspruit Healthcare', 'Mpumalanga'),
('01-NW-001', 'Rustenburg Medical', 'North West'),
('01-NC-001', 'Kimberley Hospital', 'Northern Cape');

-- Products for variety
DECLARE @Products TABLE (Id INT IDENTITY(1,1), ProductCode NVARCHAR(50), ProductDescription NVARCHAR(200), UnitPrice DECIMAL(18,2));
INSERT INTO @Products VALUES
('RT25306001', 'CATH FOLEY 2-WAY LATEX - 14FG 30ML', 450.00),
('RT25306002', 'SYRINGE 5ML LUER SLIP', 125.00),
('RT25306003', 'GLOVES NITRILE MEDIUM BOX/100', 285.00),
('RT25306004', 'BANDAGE ELASTIC 10CM', 95.00),
('RT25306005', 'IV CANNULA 18G', 175.00),
('RT25306006', 'SURGICAL MASK BOX/50', 320.00),
('RT25306007', 'STERILE GAUZE PADS 10X10CM', 145.00),
('RT25306008', 'ALCOHOL SWABS BOX/200', 220.00),
('RT25306009', 'BLOOD COLLECTION TUBE EDTA', 385.00),
('RT25306010', 'DISPOSABLE GOWN', 195.00),
('RT25306011', 'SUTURE KIT NYLON 3-0', 525.00),
('RT25306012', 'OXYGEN MASK ADULT', 275.00),
('RT25306013', 'NEBULIZER MASK', 345.00),
('RT25306014', 'URINE BAG 2000ML', 165.00),
('RT25306015', 'DRESSING PACK STERILE', 435.00);

-- Companies
DECLARE @Companies TABLE (Code NVARCHAR(10));
INSERT INTO @Companies VALUES ('PMT'), ('ACM'), ('PHT'), ('SBT');

-- Business days from Jan 5 to Jan 22, 2026
DECLARE @BusinessDays TABLE (BusinessDate DATE);
INSERT INTO @BusinessDays VALUES
('2026-01-05'), ('2026-01-06'), ('2026-01-07'), ('2026-01-08'), ('2026-01-09'),
('2026-01-12'), ('2026-01-13'), ('2026-01-14'), ('2026-01-15'), ('2026-01-16'),
('2026-01-19'), ('2026-01-20'), ('2026-01-21'), ('2026-01-22');

-- Variables for invoice generation
DECLARE @CompanyCode NVARCHAR(10);
DECLARE @BusinessDate DATE;
DECLARE @InvoiceNum INT = 200000;
DECLARE @DailyTarget DECIMAL(18,2) = 1000000.00; -- R1 Million target per day per company
DECLARE @InvoicesPerDay INT;
DECLARE @AvgInvoiceAmount DECIMAL(18,2);
DECLARE @i INT;
DECLARE @CustomerNum NVARCHAR(50);
DECLARE @CustomerNm NVARCHAR(200);
DECLARE @Province NVARCHAR(50);
DECLARE @ProductCode NVARCHAR(50);
DECLARE @ProductDesc NVARCHAR(200);
DECLARE @UnitPrice DECIMAL(18,2);
DECLARE @Qty INT;
DECLARE @Amount DECIMAL(18,2);
DECLARE @CustId INT;
DECLARE @ProdId INT;
DECLARE @TotalCustomers INT;
DECLARE @TotalProducts INT;

SELECT @TotalCustomers = COUNT(*) FROM @Customers;
SELECT @TotalProducts = COUNT(*) FROM @Products;

-- Generate invoices for each company and each business day
DECLARE company_cursor CURSOR FOR SELECT Code FROM @Companies;
OPEN company_cursor;
FETCH NEXT FROM company_cursor INTO @CompanyCode;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE date_cursor CURSOR FOR SELECT BusinessDate FROM @BusinessDays;
    OPEN date_cursor;
    FETCH NEXT FROM date_cursor INTO @BusinessDate;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Generate 15-25 invoices per day to reach ~R1M
        SET @InvoicesPerDay = 15 + (ABS(CHECKSUM(NEWID())) % 11); -- Random 15-25
        SET @AvgInvoiceAmount = @DailyTarget / @InvoicesPerDay;
        SET @i = 1;
        
        WHILE @i <= @InvoicesPerDay
        BEGIN
            -- Random customer
            SET @CustId = 1 + (ABS(CHECKSUM(NEWID())) % @TotalCustomers);
            SELECT @CustomerNum = CustomerNumber, @CustomerNm = CustomerName, @Province = Province 
            FROM @Customers WHERE Id = @CustId;
            
            -- Random product
            SET @ProdId = 1 + (ABS(CHECKSUM(NEWID())) % @TotalProducts);
            SELECT @ProductCode = ProductCode, @ProductDesc = ProductDescription, @UnitPrice = UnitPrice 
            FROM @Products WHERE Id = @ProdId;
            
            -- Random quantity and amount to roughly hit target
            SET @Qty = 50 + (ABS(CHECKSUM(NEWID())) % 450); -- 50-500 units
            SET @Amount = @AvgInvoiceAmount * (0.7 + (CAST(ABS(CHECKSUM(NEWID())) % 60 AS DECIMAL(18,2)) / 100)); -- 70%-130% of avg
            
            INSERT INTO ImportedInvoices (
                CustomerNumber, CustomerName, ProductCode, ProductDescription,
                Year, Period, TransactionType, TransactionDate, TransactionNumber,
                Category, Location, Quantity, SalesAmount, SalesReturns, CostOfSales,
                MarginPercent, Status, DeliveryProvince, SourceCompany, CreatedAt, ImportedAt
            )
            VALUES (
                @CustomerNum,
                @CustomerNm,
                @ProductCode,
                @ProductDesc,
                2026,
                '01',
                'IN',
                @BusinessDate,
                @CompanyCode + '-' + CAST(@InvoiceNum AS NVARCHAR(20)),
                1,
                1,
                @Qty,
                @Amount,
                0,
                @Amount * 0.65, -- 65% cost of sales = 35% margin
                35.0,
                'Completed',
                @Province,
                @CompanyCode,
                GETDATE(),
                GETDATE()
            );
            
            SET @InvoiceNum = @InvoiceNum + 1;
            SET @i = @i + 1;
        END
        
        FETCH NEXT FROM date_cursor INTO @BusinessDate;
    END
    
    CLOSE date_cursor;
    DEALLOCATE date_cursor;
    
    FETCH NEXT FROM company_cursor INTO @CompanyCode;
END

CLOSE company_cursor;
DEALLOCATE company_cursor;

-- Summary of inserted data
SELECT 
    SourceCompany,
    COUNT(*) as TotalInvoices,
    FORMAT(SUM(SalesAmount), 'N2') as TotalSales,
    FORMAT(AVG(SalesAmount), 'N2') as AvgInvoice,
    MIN(TransactionDate) as FirstDate,
    MAX(TransactionDate) as LastDate
FROM ImportedInvoices
WHERE SourceCompany IN ('PMT', 'ACM', 'PHT', 'SBT')
  AND TransactionDate >= '2026-01-05'
GROUP BY SourceCompany
ORDER BY SourceCompany;

PRINT 'Sales data seeded successfully!';
