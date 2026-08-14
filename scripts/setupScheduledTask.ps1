# Registers "Underwrit-AgentMonitor" as a real Windows Scheduled Task that
# runs runAllAgentMonitors.ps1 every 6 hours indefinitely.
#
# Why this exists: without it, the marketplace's evidence trail freezes at
# whatever it showed on whatever day someone last ran the agents by hand.
# Judging runs Sep 9-23, weeks after this was built — a scheduled task is
# real, durable infrastructure (survives this Claude session ending, this
# terminal closing, the computer rebooting) so evidence keeps growing for
# real through the whole judging window instead.
#
# Real dependency, stated plainly: this only fires while the machine is on
# and the "Admin" user is logged in (LogonType Interactive — no Windows
# password is stored anywhere to run it unattended while logged out, which
# would need a much bigger credential-handling ask). If the machine is off
# or logged out for a stretch, evidence generation simply pauses for that
# stretch — StartWhenAvailable means it catches up on the next run rather
# than silently drifting further behind, and nothing here ever fakes a
# timestamp to paper over a gap.
#
# Idempotent: re-running this replaces the existing task definition rather
# than erroring or duplicating it.

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument '-ExecutionPolicy Bypass -File "C:\Users\Admin\Desktop\AGENTX\scripts\runAllAgentMonitors.ps1"'

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 6) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false

Register-ScheduledTask -TaskName "Underwrit-AgentMonitor" `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description "Runs Underwrit's 4 real BNB reference agents (Health Factor Guardian, Yield Router, Rebalancer, Grid Trading) every 6h and syncs real evidence to Postgres, so the marketplace's evidence trail keeps growing for real through the hackathon judging window. Fires only while this machine is on and the user is logged in." `
    -Force

Write-Output "Registered. Check status with: Get-ScheduledTask -TaskName Underwrit-AgentMonitor"
Write-Output "Run it once immediately with: Start-ScheduledTask -TaskName Underwrit-AgentMonitor"
Write-Output "Remove it with: Unregister-ScheduledTask -TaskName Underwrit-AgentMonitor -Confirm:`$false"
