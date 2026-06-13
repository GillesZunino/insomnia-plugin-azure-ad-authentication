#  -----------------------------------------------------------------------------------
#  Copyright 2026, Gilles Zunino
#  -----------------------------------------------------------------------------------

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
'@

function Get-WindowHandleByProcessId {
    param([int]$ProcessId)
    $handles = @()
    $callback = [Win32+EnumWindowsProc] {
        param($hWnd, $lParam)
        if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
        $outPid = 0
        [Win32]::GetWindowThreadProcessId($hWnd, [ref]$outPid)
        if ($outPid -eq $ProcessId) {
            Set-Variable -Name 'handles' -Value ($handles + $hWnd) -Scope 1
        }
        return $true
    }
    [Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
    return $handles
}

$windowHandles = Get-WindowHandleByProcessId -ProcessId __the_pid__
#26896
if ($null -ne $windowHandles -and $windowHandles.Count -gt 0) {
    Write-Host $windowHandles[0]
}