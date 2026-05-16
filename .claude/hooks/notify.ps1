param(
  [string]$Title = "myorch",
  [string]$Message = "Human input required"
)

if (Get-Module -ListAvailable BurntToast) {
  New-BurntToastNotification -Text $Title, $Message
} else {
  Write-Output "${Title}: $Message"
}
