$lines = Get-Content "$env:TEMP\hashmap.txt"
$sb = New-Object System.Text.StringBuilder
foreach ($l in $lines) {
  $parts = $l -split '\|', 2
  if ($parts.Count -ne 2) { continue }
  $hash = $parts[0].Trim()
  $supplier = $parts[1].Trim().Replace("'", "''")
  if ($supplier -eq 'Unknown Supplier' -or [string]::IsNullOrWhiteSpace($supplier)) { continue }
  [void]$sb.AppendLine("UPDATE BookInvoices SET SupplierName=N'$supplier' WHERE FileHash='$hash' AND SupplierName='Unknown Supplier';")
}
Set-Content -Path "$env:TEMP\fixsuppliers.sql" -Value $sb.ToString() -Encoding ASCII
docker cp "$env:TEMP\fixsuppliers.sql" projecttracker-db:/tmp/fixsuppliers.sql
docker exec projecttracker-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd' -C -d ProjectTrackerDB -i /tmp/fixsuppliers.sql
docker exec projecttracker-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrong@Passw0rd' -C -d ProjectTrackerDB -Q "SELECT SupplierName, COUNT(*) AS Cnt FROM BookInvoices GROUP BY SupplierName ORDER BY Cnt DESC;"
