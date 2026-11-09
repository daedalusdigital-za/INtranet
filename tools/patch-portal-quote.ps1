# Patches the prebuilt client portal with the "Get Quote" feature:
#   - API service: getQuote / quotes / bookQuote / deleteQuote / quotePdf
#   - BookingForm: "Get Quote" footer button, quote() method, and a "Saved quotes" drafts panel
#     (PDF / Book this quote / Discard) rendered above the form.
# Idempotent: re-running is a no-op once the markers are present.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dir  = Join-Path $root 'client-portal\prebuilt'
$main = Join-Path $dir 'main-SN3K2ID7v2.js'
$form = Join-Path $dir 'chunk-4KFMHBI2.js'

function Patch([string]$path, [string]$old, [string]$new, [string]$what) {
    $c = [IO.File]::ReadAllText($path)
    if ($c.Contains($new)) { Write-Host "  = $what already applied"; return }
    $idx = $c.IndexOf($old, [StringComparison]::Ordinal)
    if ($idx -lt 0) { throw "Anchor not found for '$what' in $path" }
    if ($c.IndexOf($old, $idx + 1, [StringComparison]::Ordinal) -ge 0) { throw "Anchor for '$what' is not unique in $path" }
    $c = $c.Substring(0, $idx) + $new + $c.Substring($idx + $old.Length)
    [IO.File]::WriteAllText($path, $c, [Text.UTF8Encoding]::new($false))
    Write-Host "  + $what"
}

Write-Host "Patching $main"
Patch $main 'createBooking(e){return this.http.post(`${this.base}/bookings`,e)}' @'
createBooking(e){return this.http.post(`${this.base}/bookings`,e)}getQuote(e){return this.http.post(`${this.base}/bookings/quote`,e)}quotes(){return this.http.get(`${this.base}/quotes`)}bookQuote(e){return this.http.post(`${this.base}/quotes/${e}/book`,{})}deleteQuote(e){return this.http.delete(`${this.base}/quotes/${e}`)}quotePdf(e){return this.http.get(`${this.base}/quotes/${e}/pdf`)}
'@.Trim() 'API quote methods'

Write-Host "Patching $form"
# 1. footer: Get Quote button (slots 49/50) created between Cancel and Check details
Patch $form 'o(43,"a",20),r(44,"Cancel"),t(),o(45,"button",21),u("click",function(){return e.check()}),r(46),t(),' `
            'o(43,"a",20),r(44,"Cancel"),t(),o(49,"button",21),u("click",function(){return e.quote()}),r(50),t(),o(45,"button",21),u("click",function(){return e.check()}),r(46),t(),' 'Get Quote button (create)'

# 2. update bindings for the new button
Patch $form 'P(e.busy()==="save"?"Booking\u2026":"Book "+(e.shipments.length===1?"shipment":e.shipments.length+" shipments")))}' `
            'P(e.busy()==="save"?"Booking\u2026":"Book "+(e.shipments.length===1?"shipment":e.shipments.length+" shipments")),l(),c("disabled",e.busy()!==null),l(),P(e.busy()==="quote"?"Quoting\u2026":"Get Quote"))}' 'Get Quote button (update)'

# 3. slot / binding counts
Patch $form 'decls:49,vars:21,consts:[["problemBox",""]' 'decls:51,vars:23,consts:[["problemBox",""]' 'decls/vars'

# 4. load saved quotes on init
Patch $form 'this.form.valueChanges.subscribe(()=>{this.checkedOk.set(!1),this.version.update(n=>n+1)})}' `
            'this.form.valueChanges.subscribe(()=>{this.checkedOk.set(!1),this.version.update(n=>n+1)}),this.loadQuotes()}' 'ngOnInit loadQuotes'

# 5. quote(), drafts panel and actions
$methods = @'
quote(){let n=this.request(),i=B(n);if(i.length){this.showProblems(i);return}this.busy.set("quote");let w=window.open("","_blank");try{w&&(w.document.title="Preparing your quote\u2026")}catch{}this.api.getQuote(n).subscribe({next:e=>{this.busy.set(null),this.showProblems([]),this.checkedOk.set(!1);let m="Quote "+e.quoteNo+" saved as a draft: R "+Number(e.total).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})+" incl. VAT. Book it from Saved quotes when you\u2019re ready.";w?w.location.href=e.pdfUrl:window.open(e.pdfUrl,"_blank"),this.toast.show(m,"ok",9e3),this.loadQuotes(),window.scrollTo({top:0,behavior:"smooth"})},error:e=>{try{w&&w.close()}catch{}this.busy.set(null);let a=se(e);a.length?this.showProblems(a):this.toast.show(N(e,"We couldn\u2019t price this booking. Nothing was saved; try again."),"error")}})}loadQuotes(){this.api.quotes().subscribe({next:n=>setTimeout(()=>this.renderQuotes(n)),error:()=>{}})}renderQuotes(n){let h=document.querySelector("app-booking-form .page-head");if(!h)return;let d=document.getElementById("quoteDrafts");if(!n||!n.length){d&&d.remove();return}d||(d=document.createElement("section"),d.id="quoteDrafts",d.className="panel panel-pad",d.style.marginBottom="20px",h.insertAdjacentElement("afterend",d),d.addEventListener("click",a=>{let b=a.target.closest("button[data-act]");b&&this.quoteAction(b.dataset.act,+b.dataset.id,b.dataset.no)}));let E=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]),R=v=>"R "+Number(v).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2}),T="padding:8px;vertical-align:middle";d.innerHTML='<h2 style="margin:0 0 6px">Saved quotes</h2><p class="muted" style="margin:0 0 12px">Priced drafts that are not booked yet. Book one exactly as quoted, download its PDF, or discard it.</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr style="text-align:left;color:var(--ink-2)"><th style="padding:4px 8px">Quote</th><th style="padding:4px 8px">Reference</th><th style="padding:4px 8px">Shipments</th><th style="padding:4px 8px">Total incl. VAT</th><th style="padding:4px 8px">Valid until</th><th style="padding:4px 8px">Status</th><th></th></tr></thead><tbody>'+n.map(q=>{let x=q.status==="EXPIRED",k=q.status==="DRAFT";return'<tr style="border-top:1px solid var(--line)"><td style="'+T+'"><strong>'+E(q.quoteNo)+'</strong></td><td style="'+T+'">'+E(q.clientReference||"\u2014")+'</td><td style="'+T+'">'+q.shipmentCount+" \u00b7 "+Math.round(q.totalWeightKg)+' kg</td><td style="'+T+'"><strong>'+R(q.total)+'</strong></td><td style="'+T+'">'+new Date(q.validUntil).toLocaleDateString("en-ZA")+'</td><td style="'+T+'">'+(x?'<span class="muted">Expired</span>':k?"Draft":E(q.status))+'</td><td style="padding:6px 8px;white-space:nowrap;text-align:right"><button type="button" class="btn btn-ghost" data-act="pdf" data-id="'+q.id+'">PDF</button> '+(k?'<button type="button" class="btn btn-primary" data-act="book" data-id="'+q.id+'" data-no="'+E(q.quoteNo)+'">Book this quote</button> ':"")+'<button type="button" class="btn btn-ghost" data-act="del" data-id="'+q.id+'" data-no="'+E(q.quoteNo)+'">Discard</button></td></tr>'}).join("")+"</tbody></table></div>"}quoteAction(a,id,no){if(a==="pdf"){let w=window.open("","_blank");this.api.quotePdf(id).subscribe({next:e=>{w?w.location.href=e.url:window.open(e.url,"_blank")},error:e=>{try{w&&w.close()}catch{}this.toast.show(N(e,"We couldn\u2019t open the quote PDF."),"error")}})}else if(a==="book"){if(!confirm("Book quote "+no+" exactly as quoted?"))return;this.busy.set("save"),this.api.bookQuote(id).subscribe({next:e=>this.router.navigate(["/book/done",e.bookingNo],{state:{count:e.shipmentIds.length,ids:e.shipmentIds}}),error:e=>{this.busy.set(null);let p=se(e);p.length?this.showProblems(p):this.toast.show(N(e,"We couldn\u2019t book this quote."),"error")}})}else if(a==="del"){if(!confirm("Discard quote "+no+"?"))return;this.api.deleteQuote(id).subscribe({next:()=>{this.toast.show("Quote "+no+" discarded."),this.loadQuotes()},error:e=>this.toast.show(N(e,"We couldn\u2019t discard the quote."),"error")})}}submit(){let n=this.request(),i=B(n);if(i.length){this.showProblems(i);return}this.busy.set("save"),this.api.createBooking(n)
'@.Trim()
Patch $form 'submit(){let n=this.request(),i=B(n);if(i.length){this.showProblems(i);return}this.busy.set("save"),this.api.createBooking(n)' $methods 'quote()/drafts panel methods'

Write-Host "Done."
