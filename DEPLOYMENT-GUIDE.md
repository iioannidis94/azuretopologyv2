# 🚀 Azure PowerShell Deployment Guide

## Overview

This guide explains how to deploy your Azure Architecture Builder diagrams to Azure using the generated PowerShell scripts, ensuring 100% deployability.

## 📋 Prerequisites

### 1. Azure PowerShell Modules

Install the Azure PowerShell module (Az):

```powershell
# Install Azure PowerShell (run as Administrator on Windows)
Install-Module -Name Az -AllowClobber -Scope CurrentUser -Force

# Verify installation
Get-Module -ListAvailable Az*
```

Required modules:
- `Az.Accounts` - Authentication and subscription management
- `Az.Compute` - Virtual Machines, VM Scale Sets
- `Az.Network` - VNets, Subnets, Firewalls, Gateways
- `Az.Storage` - Storage Accounts, Data Lake
- `Az.Resources` - Resource Groups, Management Groups
- `Az.Aks` - Azure Kubernetes Service
- `Az.Sql` - Azure SQL Database
- `Az.KeyVault` - Azure Key Vault
- `Az.Dns` - DNS Zones
- `Az.CognitiveServices` - AI Foundry, OpenAI
- `Az.OperationalInsights` - Azure Monitor

### 2. Azure Subscription

Ensure you have:
- An active Azure subscription
- Appropriate permissions to create resources
- Subscription ID ready

### 3. Authentication

Authenticate to Azure:

```powershell
# Interactive login
Connect-AzAccount

# Or use service principal (for automation)
Connect-AzAccount -ServicePrincipal -Credential $credential -Tenant $tenantId

# Set the correct subscription context
Set-AzContext -Subscription "<subscription-name-or-id>"

# Verify current context
Get-AzContext
```

## 📝 Step-by-Step Deployment Process

### Step 1: Export PowerShell Script from Azure Architecture Builder

1. Open your architecture diagram in Azure Architecture Builder
2. Click **"⚡ Deploy via PowerShell"** button (or **"Import / Export"** → **"⚡ Deploy via PowerShell"**)
3. Review the generated script in the modal
4. Click **"⬇ Download .ps1"** to save the script locally (e.g., `azure-deploy.ps1`)

### Step 2: Review the Generated Script

Open the downloaded script and look for:

#### Validation Summary at the Top
```powershell
# Validation Summary
# Total Resources: 15
# Complete: 12
# With Warnings: 2
# With Errors: 1
```

#### Required Field Placeholders
Search for any `<REQUIRED:...>` placeholders that need to be filled:
```powershell
# Example placeholders you might see:
-StorageAccountName "<REQUIRED:storageAccountName>"
-EnvironmentName "<REQUIRED:environmentName>"
-SubscriptionId "<SUBSCRIPTION-ID>"
```

Replace these with actual values before deployment.

### Step 3: Validate the Script (100% Deployability Check)

Use the provided validation tool to ensure your script is deployment-ready:

```powershell
# Run the validation script
.\Validate-AzureDeployment.ps1 -ScriptPath ".\azure-deploy.ps1" -CheckAzModule -DetailedReport
```

The validator checks for:
- ✅ PowerShell syntax errors
- ✅ Missing required field placeholders
- ✅ Resource count and dependencies
- ✅ Azure module installation
- ✅ Authentication requirements
- ✅ Subscription context
- ✅ Naming conflicts

#### Example Validation Output

**Deployment Ready:**
```
✓ DEPLOYMENT READY

The script passed all validation checks and is ready for deployment.

Statistics:
  - Errors: 0
  - Warnings: 1
  - Resources to deploy: ~15
  - Required fields missing: 0
```

**Not Ready - Requires Action:**
```
✗ DEPLOYMENT NOT READY

The script has validation errors that must be fixed before deployment.

Statistics:
  - Errors: 3
  - Warnings: 2
  - Resources to deploy: ~15
  - Required fields missing: 3

Errors:
  ✗ REQUIRED field missing: storageAccountName (found 2 occurrence(s))
  ✗ REQUIRED field missing: environmentName (found 1 occurrence(s))
  ✗ REQUIRED field missing: SUBSCRIPTION-ID (found 1 occurrence(s))
```

### Step 4: Fix Validation Errors

If validation fails, edit your script:

```powershell
# Before (with placeholder):
-StorageAccountName "<REQUIRED:storageAccountName>"

# After (with actual value):
-StorageAccountName "mystorageacct2024"
```

Then re-run validation:
```powershell
.\Validate-AzureDeployment.ps1 -ScriptPath ".\azure-deploy.ps1" -DetailedReport
```

### Step 5: Deploy to Azure

Once validation passes with **"✓ DEPLOYMENT READY"**:

```powershell
# Ensure you're authenticated and in the correct subscription
Connect-AzAccount
Set-AzContext -Subscription "<your-subscription-name>"

# Run the deployment script
.\azure-deploy.ps1

# Monitor deployment progress in the terminal
```

⚠️ **Important:** The deployment will:
- Create resources in the order defined (dependencies first)
- Prompt for credentials if VM/VMSS resources are included
- Take several minutes to hours depending on resource count

### Step 6: Verify Deployment

After deployment completes:

```powershell
# List all resources in a resource group
Get-AzResource -ResourceGroupName "rg-hub-001" | Format-Table

# Check specific resources
Get-AzVirtualNetwork -Name "vnet-hub" -ResourceGroupName "rg-hub-001"
Get-AzVM -ResourceGroupName "rg-hub-001"

# View deployment in Azure Portal
# Navigate to: https://portal.azure.com → Resource Groups → <your-rg>
```

## 🛠️ Common Issues and Solutions

### Issue 1: Missing Required Fields

**Problem:**
```
✗ REQUIRED field missing: storageAccountName (found 2 occurrence(s))
```

**Solution:**
1. Open the script in a text editor
2. Search for `<REQUIRED:storageAccountName>`
3. Replace with a valid globally unique storage account name (3-24 lowercase alphanumeric characters)
4. Example: `mystorageacct2024`

### Issue 2: Subscription Context Not Set

**Problem:**
```
! No subscription context switching found
```

**Solution:**
```powershell
# Before running the deployment script:
Set-AzContext -Subscription "My Production Subscription"

# Or specify subscription ID:
Set-AzContext -SubscriptionId "12345678-1234-1234-1234-123456789abc"
```

### Issue 3: Azure Modules Not Installed

**Problem:**
```
! Warning: Module 'Az.Compute' is not installed
```

**Solution:**
```powershell
# Install all Azure modules
Install-Module -Name Az -AllowClobber -Scope CurrentUser -Force

# Or install specific modules
Install-Module -Name Az.Compute -Force
```

### Issue 4: Resource Name Conflicts

**Problem:**
```
! Warning: Found 2 duplicate resource name(s)
  - vnet-spoke-001
```

**Solution:**
Edit the script to ensure unique resource names across all deployments.

### Issue 5: Authentication Expired

**Problem:**
```
Connect-AzAccount : The access token is invalid.
```

**Solution:**
```powershell
# Re-authenticate
Disconnect-AzAccount
Connect-AzAccount

# Then retry deployment
.\azure-deploy.ps1
```

## 🔒 Security Best Practices

### Credentials Management

The deployment script may prompt for credentials when creating VMs or VMSS:

```powershell
# Option 1: Use interactive prompt (most secure for manual deployment)
$cred = Get-Credential -Message "Enter VM Administrator credentials"

# Option 2: Use Azure Key Vault (recommended for automation)
$secret = Get-AzKeyVaultSecret -VaultName "mykeyvault" -Name "vm-admin-password"
$password = $secret.SecretValue
$cred = New-Object System.Management.Automation.PSCredential("azureuser", $password)

# Option 3: Create credential object (less secure - avoid hardcoding passwords)
$username = "azureuser"
$password = ConvertTo-SecureString "YourSecureP@ssw0rd" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($username, $password)
```

**Never commit credentials to source control.**

### Pre-Deployment Security Checklist

Before deploying:
- [ ] Review all NSG rules for least-privilege access
- [ ] Verify private endpoints are used where appropriate
- [ ] Check that public IP addresses are only on resources that need them
- [ ] Confirm firewall rules follow your organization's security policies
- [ ] Validate DNS zones and records
- [ ] Review Key Vault access policies
- [ ] Ensure managed identities are configured where applicable
- [ ] Check that encryption is enabled on storage accounts and disks

## 💰 Cost Management

### Estimate Costs Before Deployment

1. Use the **Cost Estimator** panel in Azure Architecture Builder
2. Review the estimated monthly cost
3. Click **"View in Azure Pricing Calculator"** for detailed breakdown

### Resource Cleanup

To remove deployed resources:

```powershell
# Delete a specific resource group and all its resources
Remove-AzResourceGroup -Name "rg-hub-001" -Force

# Delete multiple resource groups
$resourceGroups = @("rg-hub-001", "rg-spoke-001", "rg-spoke-002")
foreach ($rg in $resourceGroups) {
    Remove-AzResourceGroup -Name $rg -Force -AsJob
}

# Monitor deletion jobs
Get-Job
```

⚠️ **Warning:** This will permanently delete all resources in the resource group.

## 📊 Monitoring Deployment Progress

### Real-time Monitoring

```powershell
# Watch resource group creation
Watch-AzResourceGroup -ResourceGroupName "rg-hub-001"

# View activity log
Get-AzLog -ResourceGroupName "rg-hub-001" -StartTime (Get-Date).AddHours(-1)

# Check deployment status
Get-AzResourceGroupDeployment -ResourceGroupName "rg-hub-001"
```

### Azure Portal Monitoring

1. Navigate to **Azure Portal** → **Resource Groups**
2. Select your resource group
3. Click **Deployments** to see deployment history
4. View **Activity Log** for detailed operation logs

## 🔄 Incremental Deployments

To add resources to an existing deployment:

1. Export the current state from Azure (use **"Import Azure Inventory"** in the Builder)
2. Add new resources to your diagram
3. Export new PowerShell script
4. The script will create only new resources (existing ones are checked first with `Get-Az*` cmdlets)

## 🧪 Testing in Non-Production

### Best Practice: Test First

Always deploy to a test/dev environment first:

```powershell
# Deploy to dev subscription
Set-AzContext -Subscription "Dev-Subscription"
.\azure-deploy.ps1

# Verify functionality

# Then deploy to production
Set-AzContext -Subscription "Prod-Subscription"
.\azure-deploy.ps1
```

### Using WhatIf Parameter

Some cmdlets support `-WhatIf` to preview changes without executing:

```powershell
# Example for individual resource creation
New-AzResourceGroup -Name "rg-test" -Location "eastus" -WhatIf
```

## 📚 Additional Resources

### Azure PowerShell Documentation
- [Azure PowerShell Overview](https://docs.microsoft.com/en-us/powershell/azure/)
- [Az Module Reference](https://docs.microsoft.com/en-us/powershell/module/)
- [Azure PowerShell Samples](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/deploy-powershell)

### Architecture Patterns
- [Azure Architecture Center](https://docs.microsoft.com/en-us/azure/architecture/)
- [Cloud Adoption Framework](https://docs.microsoft.com/en-us/azure/cloud-adoption-framework/)
- [Azure Well-Architected Framework](https://docs.microsoft.com/en-us/azure/architecture/framework/)

### Troubleshooting
- [Azure PowerShell Troubleshooting](https://docs.microsoft.com/en-us/powershell/azure/troubleshooting)
- [Azure Support](https://azure.microsoft.com/en-us/support/options/)

## 🎯 Quick Reference

### Pre-Deployment Checklist
- [ ] Azure PowerShell modules installed
- [ ] Authenticated to Azure (`Connect-AzAccount`)
- [ ] Correct subscription selected (`Set-AzContext`)
- [ ] Script downloaded from Azure Architecture Builder
- [ ] Validation passed (`Validate-AzureDeployment.ps1`)
- [ ] All `<REQUIRED:...>` placeholders filled
- [ ] Credentials prepared for VM/VMSS
- [ ] Cost estimate reviewed
- [ ] Security policies reviewed
- [ ] Testing environment available

### Deployment Commands
```powershell
# 1. Validate
.\Validate-AzureDeployment.ps1 -ScriptPath ".\azure-deploy.ps1" -CheckAzModule -DetailedReport

# 2. Authenticate
Connect-AzAccount
Set-AzContext -Subscription "<subscription>"

# 3. Deploy
.\azure-deploy.ps1

# 4. Verify
Get-AzResource -ResourceGroupName "rg-hub-001"
```

### Support
For issues specific to Azure Architecture Builder:
- Review validation errors carefully
- Check the [README.md](./README.md) for feature documentation
- Submit issues on GitHub

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-17  
**Compatibility:** Azure Architecture Builder v2.0+
