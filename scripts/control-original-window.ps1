param(
 [ValidateSet('Capture','Click','Drag','Wheel')][string]$Action='Capture',
 [int]$TargetProcessId=27508,
 [int]$X=0,[int]$Y=0,[int]$EndX=0,[int]$EndY=0,[int]$WheelDelta=-120,
 [string]$Output='analysis/verification/native/current.png'
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class OriginalWindow {
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int Left,Top,Right,Bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct POINT {public int X,Y;}
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h,ref POINT p);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);
}
'@
$target=Get-Process -Id $TargetProcessId
if($target.ProcessName -ne 'WeDo 2.0'){throw 'Target is not the original WeDo application.'}
$handle=$target.MainWindowHandle
$rect=New-Object OriginalWindow+RECT
if(-not [OriginalWindow]::GetClientRect($handle,[ref]$rect)){throw 'No client area.'}
if($Action -ne 'Capture'){
 foreach($point in @(@($X,$Y),@($EndX,$EndY))){if($point[0] -lt 0 -or $point[0] -ge $rect.Right -or $point[1] -lt 0 -or $point[1] -ge $rect.Bottom){throw 'Coordinate outside target.'}}
 [void][OriginalWindow]::SetForegroundWindow($handle)
 Start-Sleep -Milliseconds 250
 if([OriginalWindow]::GetForegroundWindow() -ne $handle){throw 'Target could not obtain focus; no input sent.'}
 $origin=New-Object OriginalWindow+POINT
 [void][OriginalWindow]::ClientToScreen($handle,[ref]$origin)
 [void][OriginalWindow]::SetCursorPos($origin.X+$X,$origin.Y+$Y)
 $actual=New-Object OriginalWindow+POINT
 [void][OriginalWindow]::GetCursorPos([ref]$actual)
 if($actual.X -ne $origin.X+$X -or $actual.Y -ne $origin.Y+$Y){throw 'Requested point is outside the visible desktop; no click sent.'}
 if($Action -eq 'Wheel'){
  $deltaBits=[BitConverter]::ToUInt32([BitConverter]::GetBytes($WheelDelta),0)
  [OriginalWindow]::mouse_event(2048,0,0,$deltaBits,[UIntPtr]::Zero)
 }else{
 [OriginalWindow]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
 try{
  if($Action -eq 'Drag'){for($i=1;$i -le 20;$i++){[void][OriginalWindow]::SetCursorPos($origin.X+$X+[int](($EndX-$X)*$i/20),$origin.Y+$Y+[int](($EndY-$Y)*$i/20));Start-Sleep -Milliseconds 30}}
  else{Start-Sleep -Milliseconds 80}
 }finally{[OriginalWindow]::mouse_event(4,0,0,0,[UIntPtr]::Zero)}
 }
 Start-Sleep -Milliseconds 700
}
$bitmap=New-Object System.Drawing.Bitmap($rect.Right,$rect.Bottom)
$graphics=[System.Drawing.Graphics]::FromImage($bitmap)
$dc=$graphics.GetHdc()
try{$ok=[OriginalWindow]::PrintWindow($handle,$dc,3)}finally{$graphics.ReleaseHdc($dc)}
try{
 if(-not $ok){throw 'Capture failed.'}
 $destination=[IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $PSScriptRoot) $Output))
 [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
 $bitmap.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
 Write-Output $destination
}finally{$graphics.Dispose();$bitmap.Dispose()}
