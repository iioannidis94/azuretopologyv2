# ⚡ PowerShell Deployment Quick Reference

## Pre-Deployment Checklist

- [ ] Azure PowerShell installed: `Install-Module -Name Az -Force`
- [ ] Authenticated: `Connect-AzAccount`
- [ ] Subscription set: `Set-AzContext -Subscription "<name>"`
- [ ] Script downloaded from Azure Architecture Builder
- [ ] All `<REQUIRED:...>` placeholders filled in
- [ ] Validation passed (see below)

## Validation Command

```powershell
.\Validate-AzureDeployment.ps1 -ScriptPath ".\azure-deploy.ps1" -CheckAzModule -DetailedReport
```

### Expected Output (Ready)
```
✓ DEPLOYMENT READY
The script passed all validation checks and is ready for deployment.
```

### Expected Output (Not Ready)
```
✗ DEPLOYMENT NOT READY
Errors:
  ✗ REQUIRED field missing: storageAccountName (found 2 occurrence(s))
```

## Deployment Command

```powershell
# After validation passes:
.\azure-deploy.ps1
```

## Common Fixes

### Fix Missing Required Fields
```powershell
# Search in the script for:
<REQUIRED:storageAccountName>

# Replace with actual value:
"mystorageacct2024"
```

### Set Subscription Context
```powershell
Get-AzSubscription
Set-AzContext -Subscription "Production"
```

### Install Missing Modules
```powershell
Install-Module -Name Az -AllowClobber -Scope CurrentUser -Force
```

## Verification

```powershell
# Check resources deployed
Get-AzResource -ResourceGroupName "rg-hub-001" | Format-Table

# Check specific resource types
Get-AzVirtualNetwork -ResourceGroupName "rg-hub-001"
Get-AzVM -ResourceGroupName "rg-hub-001"
```

## Cleanup

```powershell
# Remove resource group and all resources
Remove-AzResourceGroup -Name "rg-hub-001" -Force
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `<REQUIRED:...>` in script | Replace with actual values |
| `Module 'Az.X' not found` | `Install-Module -Name Az -Force` |
| `Subscription not set` | `Set-AzContext -Subscription "<name>"` |
| `Not authenticated` | `Connect-AzAccount` |
| Duplicate resource names | Edit script to use unique names |
| Script takes too long | Normal for large deployments (10-60 min) |

## Files Reference

- `Validate-AzureDeployment.ps1` - Validation tool
- `azure-deploy.ps1` - Generated deployment script
- `DEPLOYMENT-GUIDE.md` - Full deployment documentation

## Support

- **Documentation**: See [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)
- **Validation Issues**: Run validation with `-DetailedReport` flag
- **Azure Errors**: Check Azure Portal → Activity Log

---

**Tip**: Always test in a non-production subscription first!
