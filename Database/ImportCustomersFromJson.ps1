# Import Customers from JSON to LogisticsCustomers Table
# This script imports all customers and updates existing ones with richer data

$jsonPath = "c:\Users\Administrator\Documents\GitHub\INtranet\Database\customers.json"
$sqlOutputPath = "c:\Users\Administrator\Documents\GitHub\INtranet\Database\ImportAllCustomers.sql"

Write-Host "Reading JSON file..." -ForegroundColor Cyan
$customers = Get-Content $jsonPath | ConvertFrom-Json

Write-Host "Total customers in JSON: $($customers.Count)" -ForegroundColor Green

# Generate SQL MERGE statements
$sqlContent = @"
-- Import All Customers from JSON
-- Updates existing customers and inserts new ones
USE ProjectTrackerDb;
GO

PRINT 'Starting customer import...';
GO

"@

$batchId = "JSON_IMPORT_$(Get-Date -Format 'yyyyMMddHHmm')"
$sourceSystem = "ERP_Master_Data"

$count = 0
foreach ($customer in $customers) {
    $count++
    
    # Clean and escape values
    $customerNumber = $customer.customerNumber -replace "'", "''"
    $name = $customer.description -replace "'", "''"
    $shortName = if ($customer.shortName) { $customer.shortName -replace "'", "''" } else { "NULL" }
    $email = if ($customer.email) { "'$($customer.email -replace "'", "''")'" } else { "NULL" }
    $contactEmail = if ($customer.contactEmail) { "'$($customer.contactEmail -replace "'", "''")'" } else { "NULL" }
    $phone = if ($customer.phone) { "'$($customer.phone -replace "'", "''")'" } else { "NULL" }
    $fax = if ($customer.fax) { "'$($customer.fax -replace "'", "''")'" } else { "NULL" }
    $contact = if ($customer.contact) { "'$($customer.contact -replace "'", "''")'" } else { "NULL" }
    $contactPhone = if ($customer.contactPhone) { "'$($customer.contactPhone -replace "'", "''")'" } else { "NULL" }
    $contactFax = if ($customer.contactFax) { "'$($customer.contactFax -replace "'", "''")'" } else { "NULL" }
    $vatNo = if ($customer.vatNo) { "'$($customer.vatNo -replace "'", "''")'" } else { "NULL" }
    $lastMaintained = if ($customer.lastMaintained) { "'$($customer.lastMaintained)'" } else { "NULL" }
    
    # Build address from addressLines array
    $addressLinesJson = if ($customer.addressLines) {
        $jsonArray = ($customer.addressLines | ForEach-Object { "`"$($_ -replace '"', '\"')`"" }) -join ","
        "'[$jsonArray]'"
    } else {
        "NULL"
    }
    
    $physicalAddress = if ($customer.addressLines -and $customer.addressLines.Count -gt 0) {
        $fullAddress = ($customer.addressLines -join ", ") -replace "'", "''"
        "'$fullAddress'"
    } else {
        "NULL"
    }
    
    # Extract city and postal code from address lines (usually last line)
    $city = "NULL"
    $postalCode = "NULL"
    if ($customer.addressLines -and $customer.addressLines.Count -gt 1) {
        $lastLine = $customer.addressLines[-1]
        # Try to extract postal code (typically 4 digits)
        if ($lastLine -match '\b(\d{4})\b') {
            $postalCode = "'$($matches[1])'"
            $cityLine = $customer.addressLines[-2] -replace "'", "''"
            $city = "'$cityLine'"
        } else {
            $cityLine = $lastLine -replace "'", "''"
            $city = "'$cityLine'"
        }
    }
    
    $sqlContent += @"
-- Customer $count of $($customers.Count): $customerNumber
MERGE INTO LogisticsCustomers AS target
USING (SELECT '$customerNumber' AS CustomerCode) AS source
ON target.CustomerCode = source.CustomerCode
WHEN MATCHED THEN
    UPDATE SET
        Name = '$name',
        ShortName = $(if ($shortName -eq "NULL") { "NULL" } else { "'$shortName'" }),
        Email = $email,
        ContactEmail = $contactEmail,
        PhoneNumber = $phone,
        Fax = $fax,
        ContactPerson = $contact,
        ContactPhone = $contactPhone,
        ContactFax = $contactFax,
        VatNumber = $vatNo,
        PhysicalAddress = $physicalAddress,
        Address = $physicalAddress,
        City = $city,
        PostalCode = $postalCode,
        AddressLinesJson = $addressLinesJson,
        LastMaintained = $lastMaintained,
        SourceSystem = '$sourceSystem',
        ImportBatchId = '$batchId',
        UpdatedAt = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (
        CustomerCode, Name, ShortName, Email, ContactEmail,
        PhoneNumber, Fax, ContactPerson, ContactPhone, ContactFax,
        VatNumber, PhysicalAddress, Address, City, PostalCode,
        AddressLinesJson, LastMaintained, SourceSystem, ImportBatchId,
        Country, Status, CreatedAt, UpdatedAt
    )
    VALUES (
        '$customerNumber', '$name', $(if ($shortName -eq "NULL") { "NULL" } else { "'$shortName'" }), $email, $contactEmail,
        $phone, $fax, $contact, $contactPhone, $contactFax,
        $vatNo, $physicalAddress, $physicalAddress, $city, $postalCode,
        $addressLinesJson, $lastMaintained, '$sourceSystem', '$batchId',
        'South Africa', 'Active', GETDATE(), GETDATE()
    );

"@
    
    # Add GO statement every 100 records for batch processing
    if ($count % 100 -eq 0) {
        $sqlContent += "GO`n`n"
        Write-Host "Generated SQL for $count customers..." -ForegroundColor Yellow
    }
}

$sqlContent += @"
GO

-- Summary Report
PRINT '';
PRINT '=== IMPORT SUMMARY ===';
SELECT 
    COUNT(*) AS TotalCustomers,
    SUM(CASE WHEN ImportBatchId = '$batchId' THEN 1 ELSE 0 END) AS ImportedFromJSON,
    SUM(CASE WHEN ImportBatchId LIKE 'INVOICE_IMPORT%' THEN 1 ELSE 0 END) AS ImportedFromInvoices
FROM LogisticsCustomers;

PRINT '';
PRINT '=== SAMPLE UPDATED CUSTOMERS ===';
SELECT TOP 10
    CustomerCode,
    Name,
    Email,
    PhoneNumber,
    City,
    ImportBatchId
FROM LogisticsCustomers
WHERE ImportBatchId = '$batchId'
ORDER BY Name;
GO
"@

Write-Host "Writing SQL file..." -ForegroundColor Cyan
$sqlContent | Out-File -FilePath $sqlOutputPath -Encoding UTF8

Write-Host "SQL file generated: $sqlOutputPath" -ForegroundColor Green
Write-Host "Total customers processed: $count" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Copy SQL file to Docker container" -ForegroundColor White
Write-Host "2. Execute SQL via sqlcmd" -ForegroundColor White
