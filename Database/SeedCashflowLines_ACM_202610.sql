-- Access Medical standing cashflow lines (debit orders + monthly payments) from the treasurer's CASHFLOW TEMPLATE, Oct 2026.
SET NOCOUNT ON;
DECLARE @co nvarchar(10) = 'ACM', @who nvarchar(150) = 'Treasury template (Oct 2026)', @now datetime2 = SYSUTCDATETIME();
DELETE FROM CreditorCashflowLines WHERE CompanyCode = @co;
INSERT INTO CreditorCashflowLines (CompanyCode, Section, Payee, Reference, Description, Frequency, DueDay, Amount, IsActive, SortOrder, CreatedAt, UpdatedAt, UpdatedByName) VALUES
-- DEBIT ORDERS
(@co,'DebitOrder','DURAN CREDIT CARD',      NULL,'',                       'Monthly',31,  350000.00,1, 1,@now,@now,@who),
(@co,'DebitOrder','IT CREDIT CARD',         NULL,'',                       'Monthly',31,   40000.00,1, 2,@now,@now,@who),
(@co,'DebitOrder','CIPHERWAVE',             NULL,'INTERNET',               'Monthly', 1,   18075.00,1, 3,@now,@now,@who),
(@co,'DebitOrder','SASFIN',                 NULL,'',                       'Monthly', 1,    5789.82,1, 4,@now,@now,@who),
(@co,'DebitOrder','VODACOM',                NULL,'CELLPHONES',             'Monthly', 1,    3168.54,1, 5,@now,@now,@who),
(@co,'DebitOrder','IPT TRUST',              NULL,'CONSULTING',             'Monthly', 1,    1406.65,1, 6,@now,@now,@who),
(@co,'DebitOrder','MULTI RUSA',             NULL,'SECURITY',               'Monthly', 1,     776.00,1, 7,@now,@now,@who),
(@co,'DebitOrder','MARSHALL',               NULL,'SECURITY',               'Monthly', 1,     730.79,1, 8,@now,@now,@who),
(@co,'DebitOrder','MARSHALL',               NULL,'SECURITY',               'Monthly', 1,     730.77,1, 9,@now,@now,@who),
(@co,'DebitOrder','MARSHALL',               NULL,'SECURITY',               'Monthly', 1,     730.77,1,10,@now,@now,@who),
(@co,'DebitOrder','FLEETCAM',               NULL,'FLEETCAM',               'Monthly', 1,     309.35,1,11,@now,@now,@who),
(@co,'DebitOrder','REALCAM',                NULL,'SECURITY',               'Monthly', 5,    6560.40,1,12,@now,@now,@who),
(@co,'DebitOrder','MULTI FORUM',            'ZIM318D','SECURITY',          'Monthly', 7,    3350.00,1,13,@now,@now,@who),
(@co,'DebitOrder','MULTI FORUM',            'ZIM0329D','SECURITY',         'Monthly', 7,     350.00,1,14,@now,@now,@who),
(@co,'DebitOrder','BANK CHARGES',           NULL,'',                       'Monthly',31,    3000.00,1,15,@now,@now,@who),
-- MONTHLY PAYMENTS
(@co,'Monthly','BLACK TIE',                 NULL,'TELEPHONES',             'Monthly',31,   12678.75,1, 1,@now,@now,@who),
(@co,'Monthly','SYNAPTIX',                  NULL,'',                       'Monthly',31,    8387.00,1, 2,@now,@now,@who),
(@co,'Monthly','ETHEKWINI',                 NULL,'UTILITIES',              'Monthly',26,   30000.00,1, 3,@now,@now,@who),
(@co,'Monthly','SA WELLNESS',               NULL,'RENT - 25 DRIFT',        'Monthly',31,  129844.57,1, 4,@now,@now,@who),
(@co,'Monthly','SA WELLNESS',               NULL,'RENT - 847 PEACH TREE',  'Monthly',31,   57928.48,1, 5,@now,@now,@who),
(@co,'Monthly','SA WELLNESS',               NULL,'RENT - 8 PEARL DRIVE',   'Monthly',31,   99074.06,1, 6,@now,@now,@who),
(@co,'Monthly','SALARIES',                  NULL,'',                       'Monthly',25,  600000.00,1, 7,@now,@now,@who),
(@co,'Monthly','SAGE',                      NULL,'SAGE',                   'Monthly', 9,    6484.85,1, 8,@now,@now,@who),
(@co,'Monthly','VAT',                       NULL,'SARS',                   'Monthly',31,  290000.00,1, 9,@now,@now,@who),
(@co,'Monthly','EMP201',                    NULL,'SARS',                   'Monthly', 7,   90000.00,1,10,@now,@now,@who),
(@co,'Monthly','ROCKET FREIGHT',            NULL,'VEHICLE RENTAL',         'Monthly',31,  475989.13,1,11,@now,@now,@who),
(@co,'Monthly','ROCKET FREIGHT',            NULL,'DELIVERY CHARGES',       'Monthly',31, 1500000.00,1,12,@now,@now,@who);
SELECT Section, COUNT(*) n, SUM(Amount) total FROM CreditorCashflowLines WHERE CompanyCode=@co GROUP BY Section;
