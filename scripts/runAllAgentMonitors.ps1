# Runs every deployed reference agent's real monitor.ts, then re-syncs its
# real evidence into Postgres — the whole point being that the marketplace's
# evidence trail keeps growing for real through the Sep 9-23 judging window
# instead of freezing at whatever it showed on the day this was built.
#
# Registered as a real Windows Scheduled Task (see setupScheduledTask.ps1) —
# this only fires while the machine is on; if it's asleep/off, evidence
# generation simply pauses for that stretch, which is honest (nothing here
# fakes a timestamp), not silently broken.
#
# Each agent's monitor.ts is independent and already idempotent/self-
# contained (loads its own .studio/.env.local, uses its own real wallet) —
# one agent failing (e.g. insufficient gas, a transient RPC error) must not
# block the others, so every step is wrapped and logged rather than let a
# single failure abort the whole run.

$ErrorActionPreference = "Continue"
$root = "C:\Users\Admin\Desktop\AGENTX"
$logDir = "$root\scripts\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = "$logDir\monitor-run-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

# Grid Trading has no Sync entry yet — its DB Agent row needs a real
# ERC-8004 agentId, which only comes from `bag deploy verify` after a
# platform deploy slot frees up (still blocked as of this writing, see
# project memory). Its monitor.ts still runs below — real transactions
# keep landing on-chain either way — just not synced to Postgres until
# that unblocks. Add "Sync" = "sync:grid-trading" here once
# packages/db/scripts/syncGridTrading.ts exists.
$agents = @(
    @{ Name = "healthfactormonitor"; Sync = "sync:health-factor-guardian" },
    @{ Name = "yieldrouter"; Sync = "sync:yield-router" },
    @{ Name = "rebalancer"; Sync = "sync:rebalancer" },
    @{ Name = "gridtrading"; Sync = $null }
)

Write-Log "=== Starting agent monitor run ==="

foreach ($agent in $agents) {
    $agentDir = "$root\apps\agents\$($agent.Name)\app\agent"
    if (-not (Test-Path $agentDir)) {
        Write-Log "SKIP $($agent.Name): directory not found"
        continue
    }

    Write-Log "--- $($agent.Name): running monitor.ts ---"
    try {
        Push-Location $agentDir
        $output = & npx tsx src/monitor.ts 2>&1 | Out-String
        Write-Log $output
        Pop-Location
    } catch {
        Write-Log "ERROR running $($agent.Name)'s monitor.ts: $_"
        if ((Get-Location).Path -eq $agentDir) { Pop-Location }
    }
}

Write-Log "--- Re-syncing evidence to Postgres ---"
foreach ($agent in $agents) {
    if (-not $agent.Sync) {
        Write-Log "SKIP $($agent.Name) sync: no sync script wired yet"
        continue
    }
    try {
        Push-Location $root
        $output = & npm run $($agent.Sync) 2>&1 | Out-String
        Write-Log "$($agent.Name) sync: $output"
        Pop-Location
    } catch {
        Write-Log "ERROR syncing $($agent.Name): $_"
        if ((Get-Location).Path -eq $root) { Pop-Location }
    }
}

Write-Log "=== Run complete ==="

# Keep only the last 50 log files so this doesn't grow unbounded over a month.
Get-ChildItem -Path $logDir -Filter "monitor-run-*.log" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 50 |
    Remove-Item -Force -ErrorAction SilentlyContinue
