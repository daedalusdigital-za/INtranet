"""Repair Users.Permissions strings that were stored letter-by-letter (e.g. "s,a,l,e,s,,,a,i").

Rule: split on ','. A run of single-character tokens is a word spelled out; an empty token inside such a run is
the separator between two spelled-out words. Multi-character tokens are already proper permission keys.
Prints the repaired list per user and an UPDATE statement; run with --apply to execute against the container DB.
"""
import re, subprocess, sys

SQLCMD = ["docker", "exec", "projecttracker-db", "/opt/mssql-tools18/bin/sqlcmd", "-C", "-S", "localhost", "-U", "sa", "-d", "ProjectTrackerDB"]

def repair(raw: str) -> list[str]:
    out: list[str] = []; word = ""
    for tok in raw.split(","):
        t = tok.strip()
        if len(t) == 1:
            word += t
        elif t == "":
            if word: out.append(word); word = ""
        else:
            if word: out.append(word); word = ""
            out.append(t)
    if word: out.append(word)
    seen: set[str] = set(); clean: list[str] = []
    for p in out:
        if re.fullmatch(r"[a-z][a-z0-9_.\-]*", p) and p not in seen: seen.add(p); clean.append(p)
    return clean

def main():
    pw = sys.argv[1]; apply = "--apply" in sys.argv
    q = "SET NOCOUNT ON; SELECT CAST(UserId AS varchar)+'|'+Permissions FROM Users WHERE Permissions IS NOT NULL AND EXISTS (SELECT 1 FROM STRING_SPLIT(Permissions,',') WHERE LEN(TRIM(value))<=1)"
    res = subprocess.run(SQLCMD + ["-P", pw, "-y", "0", "-w", "65535", "-Q", q], capture_output=True, text=True).stdout
    rows = [l.strip() for l in res.splitlines() if "|" in l and l.strip()[0].isdigit()]
    if not rows: print("No corrupted permission strings found."); return
    stmts = []
    for line in rows:
        uid, raw = line.split("|", 1)
        fixed = repair(raw)
        print(f"User {uid}: {len(raw)} chars -> {len(fixed)} permissions\n  {', '.join(fixed)}")
        stmts.append(f"UPDATE Users SET Permissions = '{','.join(fixed)}' WHERE UserId = {uid};")
    sql = "\n".join(stmts)
    print("\n" + sql)
    if apply:
        r = subprocess.run(SQLCMD + ["-P", pw, "-Q", sql], capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())

if __name__ == "__main__":
    main()
