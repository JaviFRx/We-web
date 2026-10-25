param([int]$TargetProcessId = 27508)
$ErrorActionPreference = 'Stop'
$target = Get-Process -Id $TargetProcessId
if ($target.ProcessName -ne 'WeDo 2.0') { throw 'The selected process is not WeDo 2.0.' }
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WeDoCapture {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd,out RECT rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd,IntPtr hDC,uint flags);
}
'@
$rect = New-Object WeDoCapture+RECT
if (-not [WeDoCapture]::GetClientRect($target.MainWindowHandle,[ref]$rect)) { throw 'Window has no client area.' }
$bitmap = New-Object System.Drawing.Bitmap($rect.Right,$rect.Bottom)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$dc = $graphics.GetHdc()
try { $ok = [WeDoCapture]::PrintWindow($target.MainWindowHandle,$dc,3) } finally { $graphics.ReleaseHdc($dc) }
try {
 if (-not $ok) { throw 'Native window capture failed.' }
 $destination = Join-Path (Split-Path -Parent $PSScriptRoot) 'analysis\original-native-current.png'
 $bitmap.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
 Write-Output "$destination ($($rect.Right)x$($rect.Bottom))"
} finally { $graphics.Dispose(); $bitmap.Dispose() }
