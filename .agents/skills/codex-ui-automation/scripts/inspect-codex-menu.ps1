param(
  [string]$WindowName = "Codex",
  [string]$ProcessName = "Codex.exe",
  [string]$MenuName = "",
  [int]$WaitSeconds = 5,
  [switch]$OpenSettingsMenu
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Get-BoundsText {
  param([System.Windows.Automation.AutomationElement]$Element)

  try {
    $rect = $Element.Current.BoundingRectangle
    if (
      [double]::IsInfinity($rect.X) -or
      [double]::IsInfinity($rect.Y) -or
      [double]::IsInfinity($rect.Width) -or
      [double]::IsInfinity($rect.Height)
    ) {
      return ""
    }

    return "$([math]::Round($rect.X)),$([math]::Round($rect.Y)),$([math]::Round($rect.Width)),$([math]::Round($rect.Height))"
  } catch {
    return ""
  }
}

function Convert-ElementToRow {
  param(
    [System.Windows.Automation.AutomationElement]$Element,
    [string]$Kind,
    [int]$MenuIndex,
    [Nullable[int]]$ChildIndex = $null
  )

  [pscustomobject]@{
    kind = $Kind
    menuIndex = $MenuIndex
    childIndex = $ChildIndex
    name = $Element.Current.Name
    controlType = $Element.Current.ControlType.ProgrammaticName
    className = $Element.Current.ClassName
    automationId = $Element.Current.AutomationId
    bounds = Get-BoundsText -Element $Element
  }
}

function Find-CodexWindow {
  $desktop = [System.Windows.Automation.AutomationElement]::RootElement
  $windows = $desktop.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  foreach ($window in $windows) {
    try {
      $process = Get-Process -Id $window.Current.ProcessId -ErrorAction SilentlyContinue
      if (
        $window.Current.Name -eq $WindowName -and
        $process -ne $null -and
        $process.ProcessName + ".exe" -eq $ProcessName
      ) {
        return $window
      }
    } catch {
    }
  }

  return $null
}

function Find-Menus {
  param([System.Windows.Automation.AutomationElement]$Window)

  $menuCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Menu
  )

  $menus = $Window.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    $menuCondition
  )

  $matches = @()
  foreach ($menu in $menus) {
    try {
      if ($MenuName -and $menu.Current.Name -ne $MenuName) {
        continue
      }

      if ($menu.Current.BoundingRectangle.Width -lt 100) {
        continue
      }

      $matches += $menu
    } catch {
    }
  }

  return $matches
}

function Invoke-Element {
  param([System.Windows.Automation.AutomationElement]$Element)

  if ($null -eq $Element) {
    throw "Element not found."
  }

  try {
    $invoke = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invoke.Invoke()
    return
  } catch {
  }

  $point = $Element.GetClickablePoint()
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point([int]$point.X, [int]$point.Y)

  if (-not ("MouseClicker" -as [type])) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MouseClicker {
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
'@
  }

  [MouseClicker]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [MouseClicker]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
}

function Find-SettingsProfileButton {
  param([System.Windows.Automation.AutomationElement]$Window)

  $all = $Window.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  foreach ($element in $all) {
    try {
      if (
        $element.Current.Name -eq "Settings" -and
        $element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button -and
        $element.Current.BoundingRectangle.Width -gt 100
      ) {
        return $element
      }
    } catch {
    }
  }

  return $null
}

$deadline = (Get-Date).AddSeconds([math]::Max(0, $WaitSeconds))
$codexWindow = $null
$menus = @()

do {
  $codexWindow = Find-CodexWindow
  if ($codexWindow -ne $null -and $OpenSettingsMenu) {
    Invoke-Element -Element (Find-SettingsProfileButton -Window $codexWindow)
    Start-Sleep -Milliseconds 500
    $OpenSettingsMenu = $false
  }

  if ($codexWindow -ne $null) {
    $menus = Find-Menus -Window $codexWindow
  }

  if ($menus.Count -gt 0 -or (Get-Date) -ge $deadline) {
    break
  }

  Start-Sleep -Milliseconds 250
} while ($true)

if ($codexWindow -eq $null) {
  throw "Could not find top-level '$WindowName' window for process '$ProcessName'."
}

$rows = New-Object System.Collections.Generic.List[object]
for ($menuIndex = 0; $menuIndex -lt $menus.Count; $menuIndex++) {
  $menu = $menus[$menuIndex]
  $rows.Add((Convert-ElementToRow -Element $menu -Kind "menu" -MenuIndex $menuIndex))

  $children = $menu.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition
  )

  for ($childIndex = 0; $childIndex -lt $children.Count; $childIndex++) {
    $rows.Add((Convert-ElementToRow -Element $children[$childIndex] -Kind "child" -MenuIndex $menuIndex -ChildIndex $childIndex))
  }
}

if ($rows.Count -eq 0) {
  "[]"
} else {
  $rows | ConvertTo-Json -Depth 4
}
