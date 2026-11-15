# ai-gen.ps1 - size-finder pictures from the ChatGPT image model on kie.ai, guided by a reference picture.
# Spec = JSON array of {name, prompt}. Every paid job's task id is written to ai\tasks-log.tsv the moment it is created,
# so a stopped run can be resumed without paying twice.
#   & .\ai-gen.ps1 -Spec ai\tee.json -Ref <url> [-Model gpt-image-2-image-to-image] [-Transparent] [-Only a,b]
param([Parameter(Mandatory)][string]$Spec, [string]$Ref = '',
      [string]$Model = 'gpt-image-2-image-to-image', [switch]$Transparent, [string]$Resolution = '1K', [string[]]$Only = @())
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $PSScriptRoot 'ai'; $outDir = Join-Path $dir 'out'; New-Item -ItemType Directory -Force $outDir | Out-Null
$key = ((Get-Content D:\new\tshirt-designs\.env | Where-Object { $_ -match '^KIE_API_KEY_FULL=' }) -split '=', 2)[1].Trim()
$hdr = @{ Authorization = "Bearer $key"; 'Content-Type' = 'application/json' }
$shots = [IO.File]::ReadAllText((Join-Path $PSScriptRoot $Spec)) | ConvertFrom-Json
$logf = Join-Path $dir 'tasks-log.tsv'; $logged = @{}
if (Test-Path $logf) { foreach ($l in [IO.File]::ReadAllLines($logf)) { $p = $l -split "`t"; if ($p.Count -ge 2) { $logged[$p[0]] = $p[1] } } }
$tasks = @{}
foreach ($s in $shots) {
  $n = $s.name
  if ($Only.Count -and $Only -notcontains $n) { continue }
  if (Test-Path "$outDir\$n.png") { "$n already done"; continue }
  if ($logged.ContainsKey($n)) { $tasks[$n] = $logged[$n]; "$n resuming $($logged[$n])"; continue }
  # per shot: "ref" (guide picture url; none = text only), "opaque": true for a real background
  $r = if ($s.ref) { $s.ref } else { $Ref }
  $inp = @{ prompt = $s.prompt; aspect_ratio = '1:1'; resolution = $Resolution }
  if ($r) { $inp['input_urls'] = @($r); $m = $Model } else { $m = 'gpt-image-2-text-to-image' }
  if ($Transparent -and -not $s.opaque) { $inp['background'] = 'transparent' }
  $body = @{ model = $m; input = $inp } | ConvertTo-Json -Depth 5
  $c = Invoke-RestMethod -Uri 'https://api.kie.ai/api/v1/jobs/createTask' -Method Post -Headers $hdr -Body $body
  if ($c.code -ne 200) { "$n NOT CREATED (no charge): $($c.msg)"; continue }
  $tasks[$n] = $c.data.taskId; [IO.File]::AppendAllText($logf, "$n`t$($c.data.taskId)`t$m`r`n"); "$n created $($c.data.taskId)"
  Start-Sleep -Milliseconds 1200
}
$left = @($tasks.Keys)
for ($i = 0; $i -lt 90 -and $left.Count; $i++) {
  Start-Sleep -Seconds 8
  foreach ($n in @($left)) {
    try { $r = Invoke-RestMethod -Uri "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=$($tasks[$n])" -Headers $hdr } catch { continue }
    if ($r.data.state -eq 'success') {
      Invoke-WebRequest -Uri (($r.data.resultJson | ConvertFrom-Json).resultUrls)[0] -OutFile "$outDir\$n.png"; "$n saved"
      $left = @($left | Where-Object { $_ -ne $n })
    } elseif ($r.data.state -eq 'fail') { "$n FAILED: $($r.data.failMsg)"; $left = @($left | Where-Object { $_ -ne $n }) }
  }
}
"done; still waiting: $($left -join ', ')"
