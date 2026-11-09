# Patch the prebuilt address-book chunk: the compiled <form> listens for ngSubmit but has no [formGroup]
# directive, so Angular never fires it and the type="submit" button does a native page reload (nothing saved).
# Fix: make the button type="button" and wire its click to save(). Applied to both copies of the chunk.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot '..\client-portal\prebuilt'
foreach ($f in @('chunk-M6CH42S4.js', 'chunk-M6CH42S4v2.js')) {
    $p = Join-Path $dir $f
    $t = [IO.File]::ReadAllText($p)
    $oldConst = '["type","submit",1,"btn","btn-primary",3,"disabled"]'
    $newConst = '["type","button",1,"btn","btn-primary",3,"disabled","click"]'
    $oldEl = 'r(7,"div",12)(8,"button",13),o(9),n()'
    $newEl = 'r(7,"div",12)(8,"button",13),p("click",function(){c(e);let s=l();return m(s.save())}),o(9),n()'
    if ($t.Contains($newEl)) { "$f already patched"; continue }
    if (-not $t.Contains($oldConst) -or -not $t.Contains($oldEl)) { throw "${f}: expected markers not found" }
    $t = $t.Replace($oldConst, $newConst).Replace($oldEl, $newEl)
    [IO.File]::WriteAllText($p, $t)
    "$f patched"
}
