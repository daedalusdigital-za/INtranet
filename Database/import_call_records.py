"""Import PBX call records from CSV files into the CallRecords table."""
import csv
import os
import sys
from datetime import datetime

# pip install pyodbc if not installed
try:
    import pyodbc
except ImportError:
    os.system('pip install pyodbc')
    import pyodbc

CSV_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'docs', 'Master')
CONN_STR = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=127.0.0.1,1435;"
    "DATABASE=ProjectTrackerDB;"
    "UID=sa;"
    "PWD=YourStrong@Passw0rd;"
    "TrustServerCertificate=yes;"
)

def parse_datetime(val):
    """Parse a datetime string, return None if invalid."""
    if not val or not val.strip():
        return None
    try:
        return datetime.strptime(val.strip(), '%Y-%m-%d %H:%M:%S')
    except ValueError:
        try:
            return datetime.strptime(val.strip(), '%Y-%m-%d %H:%M')
        except ValueError:
            return None

def parse_int(val):
    """Parse an int, return 0 if invalid."""
    try:
        return int(val.strip()) if val and val.strip() else 0
    except ValueError:
        return 0

def truncate(val, max_len):
    """Truncate string to max length, return None if empty."""
    if not val or not val.strip():
        return None
    return val.strip()[:max_len]

def main():
    conn = pyodbc.connect(CONN_STR)
    cursor = conn.cursor()
    
    # Check current count
    cursor.execute("SELECT COUNT(*) FROM CallRecords")
    existing = cursor.fetchone()[0]
    print(f"Existing records in CallRecords: {existing}")
    
    if existing > 0:
        resp = input(f"Table already has {existing} records. Clear and reimport? (y/n): ").strip().lower()
        if resp == 'y':
            cursor.execute("TRUNCATE TABLE CallRecords")
            conn.commit()
            print("Table truncated.")
        else:
            print("Appending to existing data.")
    
    # Get all CSV files sorted
    csv_files = sorted([
        f for f in os.listdir(CSV_FOLDER) 
        if f.endswith('.csv')
    ])
    print(f"\nFound {len(csv_files)} CSV files to import")
    
    insert_sql = """
    INSERT INTO CallRecords (
        AccountCode, CallerNumber, CallerNat, CalleeNumber, CalleeNat,
        Context, CallerId, SourceChannel, DestChannel, LastApp, LastData,
        StartTime, AnswerTime, EndTime, CallTime, TalkTime,
        CallStatus, AmaFlags, UniqueId, CallType, DestChannelExtension,
        CallerName, AnsweredBy, Session, PremierCaller, ActionType,
        SourceTrunkName, DestinationTrunkName
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    total_imported = 0
    total_skipped = 0
    
    for csv_file in csv_files:
        filepath = os.path.join(CSV_FOLDER, csv_file)
        print(f"\nProcessing: {csv_file}")
        
        batch = []
        skipped = 0
        
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Parse required fields
                start_time = parse_datetime(row.get('Start Time', ''))
                caller_num = truncate(row.get('Caller Number', ''), 50)
                callee_num = truncate(row.get('Callee Number', ''), 50)
                call_status = truncate(row.get('Call Status', ''), 20) or 'UNKNOWN'
                call_type = truncate(row.get('Call Type', ''), 20) or 'Unknown'
                
                if not start_time or not caller_num or not callee_num:
                    skipped += 1
                    continue
                
                params = (
                    truncate(row.get('Account Code', ''), 50),
                    caller_num,
                    truncate(row.get('Caller NAT', ''), 10),
                    callee_num,
                    truncate(row.get('Callee NAT', ''), 10),
                    truncate(row.get('Context', ''), 100),
                    truncate(row.get('Caller ID', ''), 500),
                    truncate(row.get('Source Channel', ''), 200),
                    truncate(row.get('Dest. Channel', ''), 200),
                    truncate(row.get('Last app.', ''), 100),
                    truncate(row.get('Last data', ''), 500),
                    start_time,
                    parse_datetime(row.get('Answer Time', '')),
                    parse_datetime(row.get('End Time', '')),
                    parse_int(row.get('Call Time', '0')),
                    parse_int(row.get('Talk Time', '0')),
                    call_status,
                    truncate(row.get('AMA Flags', ''), 50),
                    truncate(row.get('Unique ID', ''), 100),
                    call_type,
                    truncate(row.get('Dest Channel Extension', ''), 100),
                    truncate(row.get('Caller Name', ''), 200),
                    truncate(row.get('Answered by', ''), 200),
                    truncate(row.get('Session', ''), 200),
                    truncate(row.get('Premier Caller', ''), 100),
                    truncate(row.get('Action Type', ''), 50),
                    truncate(row.get('Source Trunk Name', ''), 200),
                    truncate(row.get('Destination Trunk Name', ''), 200),
                )
                batch.append(params)
                
                # Insert in batches of 1000
                if len(batch) >= 1000:
                    cursor.fast_executemany = True
                    cursor.executemany(insert_sql, batch)
                    conn.commit()
                    batch = []
        
        # Insert remaining
        if batch:
            cursor.fast_executemany = True
            cursor.executemany(insert_sql, batch)
            conn.commit()
        
        file_count = sum(1 for _ in open(filepath, encoding='utf-8', errors='replace')) - 1  # minus header
        imported = file_count - skipped
        total_imported += imported
        total_skipped += skipped
        print(f"  Imported: {imported}, Skipped: {skipped}")
    
    # Final count
    cursor.execute("SELECT COUNT(*) FROM CallRecords")
    final_count = cursor.fetchone()[0]
    
    print(f"\n{'='*50}")
    print(f"Import Complete!")
    print(f"Total Imported: {total_imported}")
    print(f"Total Skipped: {total_skipped}")
    print(f"Total Records in DB: {final_count}")
    print(f"{'='*50}")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
