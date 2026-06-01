# ☁️ Azure Architecture Builder

The **Azure Architecture Builder** is a comprehensive, visual Azure architecture design tool that runs **100% client-side** in the browser. It allows you to rapidly build diagrams for **Hub & Spoke**, **Landing Zones**, **Hybrid topologies**, **application platforms**, and **data / AI workloads**, while simultaneously generating practical outputs such as **PNG**, **JSON**, **Azure PowerShell**, and **Bicep**.

The application is built with **Vanilla JavaScript**, **HTML5 Canvas**, **ES Modules**, and **CSS3**, with no backend and no build process. Just open the project and start immediately.

---

## 🎯 The Problem it Solves

This project was created to fill a very specific gap:

- Traditional design in Visio, Draw.io, or PowerPoint is good for documentation, but doesn't help you transition easily from diagram to implementation.
- In complex Azure architectures, it's easy to lose the big picture among subscriptions, resource groups, VNets, subnets, and services.
- Rough cost estimation, security, and pattern reusability are usually done in a fragmented and slow manner.
- Importing existing Azure resources into a clean diagram is often manual and time-consuming.

### In a nutshell
The Azure Architecture Builder combines **visual design**, **Azure-aware modeling**, **cost awareness**, **security hints**, **template-based acceleration**, and **IaC export** into a single static application.

---

## 👥 Who is it for

- **Cloud Architects** who want rapid design and presentation of solutions
- **DevOps / Platform Engineers** looking for an initial deployment scaffold
- **Presales / Solution Engineers** who need to quickly showcase topology options
- **Consultants / MSP teams** working with multiple subscriptions and landing zones
- **Engineering teams** that need a common visual language for Azure infrastructure

---

## 🧩 What you can model

The application organizes the architecture according to actual Azure logic:

- **Subscriptions**
- **Resource Groups**
- **Hub VNet**
- **Spoke VNets**
- **Subnets**
- **Subnet-level resources**
- **Resource-group level resources**
- **On-premises / hybrid connectivity**
- **VNet peerings**

This means you aren't just drawing boxes, but a structure that follows the true Azure operational model.

---

## ✅ Key Features

### 1. Visual Azure architecture design

- Create and manage **subscriptions**, **resource groups**, **VNets**, and **subnets**
- Support for **Hub & Spoke** architectures
- Support for **hybrid scenarios** with an on-premises datacenter
- **Any-to-any peering** between VNets
- Edit names and properties directly from the UI
- Select elements and quickly update properties from the right editor

### 2. Support for multiple Azure resource types

Resources are organized into categories:

- **Compute**: Virtual Machine, VM Scale Set, AKS, Function App, Container Apps
- **Networking**: Azure Firewall, FortiGate NVA, App Gateway, Load Balancer, VPN Gateway, ExpressRoute Gateway, Azure Bastion, Front Door, Private Endpoint, Private DNS Zone, Public DNS Zone, NSG
- **Data & Storage**: Azure SQL, Cosmos DB, Storage Account, Azure Cache for Redis, Data Lake
- **Security**: Key Vault
- **Integration**: App Service, API Management, Service Bus, Event Hub, Logic App
- **AI & Analytics**: AI Foundry, Azure OpenAI
- **Management**: Azure Monitor

Each resource type comes with:

- default configuration
- indicative monthly cost
- icon mapping
- category mapping
- properties for UI editing

### 3. Canvas interaction and productivity

- **Drag & drop** movement of elements
- **Group drag** to move entire containers along with their children
- **Pan & zoom** on the canvas
- **Fit to screen**
- **Grid layout** and **Radial layout**
- **Inline rename**
- **Theme toggle**
- **Desktop and mobile panel navigation**

### 4. Undo / Redo history

The application includes a standard history workflow:

- **Undo**
- **Redo**
- keyboard shortcuts
- support for changes like add, remove, move, rename, and topology updates

### 5. Cost awareness

There is a built-in **Cost Estimator** that:

- calculates estimated monthly cost
- dynamically updates as the diagram changes
- can direct you to the **Azure Pricing Calculator**

### 6. Security posture visibility

The **Security Posture panel** provides instant feedback on core architectural topics, such as:

- potential gaps in network isolation
- missing private connectivity where it makes sense
- best-practice recommendations for specific resources
- summary security score / health view

### 7. JSON import / export

You can:

- export the current diagram to **JSON**
- import a diagram from a **JSON file**
- import from pasted JSON
- view a preview and validation before replacing the existing diagram
- **merge** imported resources into the existing diagram (instead of replacing)

### 8. Azure inventory import

The application supports importing from an actual Azure inventory via:

- `az resource list`
- `az graph query`
- `Get-AzResource`

The import flow includes:

- file upload or JSON paste
- preview before import
- mapping Azure resource types to supported visual resources
- reconstructing the hierarchy based on subscriptions, resource groups, and network context
- **merge option** to add resources to the existing diagram without replacing it

### 9. IaC & artifact generation

You can generate:

- **PNG** for documentation or presentations
- **JSON** to save / exchange diagrams
- **Azure PowerShell deployment script**
- **Bicep template**

This makes the tool useful not only for visualization but also for **handover to implementation**.

### 10. Template Gallery

The application includes ready-made templates for a quick start:

- **Hub & Spoke Basic**
- **Multi-Region DR**
- **Web App + Database**
- **AKS Networking**
- **Landing Zone (CAF)**

Templates accelerate prototyping and provide common starting points for frequent Azure patterns.

### 11. Auto-save and state persistence

- Changes are automatically saved to **localStorage**
- The project remembers the state of the diagram without a backend
- Actions available to reset the diagram and reset custom positions

---

## 🛠️ Detailed Functional Scope

### Architecture hierarchy

The tool doesn't stop at simple objects. It allows you to express:

- tenant-like organization via multiple subscriptions
- resource placement per RG
- network boundaries per VNet / subnet
- peerings between isolated environments
- hybrid entry points via VPN / ExpressRoute
- deployment segmentation for app, data, security, and management layers

### Properties editor

From the right panel, you can configure:

- names and metadata
- Azure region / location
- CIDR blocks
- subnet definitions
- peering configuration
- tags
- resource-specific properties such as SKU, tier, version, replicas, TLS settings, identities, backup, retention, access policies, and much more

### Resource-group level modeling

You aren't restricted to subnet-based resources. There is support for resources that logically belong at the **resource group** level, like DNS zones.

### Network-aware design

The project emphasizes architectures where networking is a central component:

- hub-spoke segmentation
- shared services in the hub
- edge / ingress components
- private connectivity
- DNS dependencies
- firewall / gateway placement

---

## 📦 What outputs you get

### For documentation

- diagram in PNG
- clean visual topology for design reviews
- artifact for proposals, HLDs, and workshops

### For engineering handoff

- JSON representation of the diagram
- initial **PowerShell deployment script**
- initial **Bicep template**

### For discovery / reverse modeling

- import from Azure inventory
- convert existing environment into a visual layout

---

## 🚀 Quick Start

No installation required.

### Option 1: Direct open

Open the file:

```bash
open index.html
```

or on Linux:

```bash
xdg-open index.html
```

### Option 2: Local static server

```bash
cd <project-directory>
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The second option is practical because the project uses **ES modules**.

---

## 📚 Typical Usage Workflow

1. Create or organize **Subscriptions**
2. Add the appropriate **Resource Groups**
3. Build the **Hub VNet**
4. Add **Spoke VNets**
5. Define **Subnets**
6. Place **Azure resources**
7. Configure **peerings**, hybrid connectivity, and resource properties
8. Review **cost** and **security posture**
9. Refine the layout
10. Export **PNG / JSON / PowerShell / Bicep**

---

## ⌨️ Keyboard Shortcuts

- **Delete / Backspace**: delete selected element
- **Escape**: deselect or close modal
- **Arrow Keys**: nudge elements
- **+ / =**: zoom in
- **-**: zoom out
- **Ctrl/⌘ + 0**: fit to screen
- **Ctrl/⌘ + Z**: undo
- **Ctrl/⌘ + Y**: redo
- **?**: open shortcut help panel

---

## 🧱 Technological Approach

The project is a **zero-dependency static SPA**.

### Stack

- **HTML5**
- **CSS3**
- **Vanilla JavaScript (ES Modules)**
- **HTML5 Canvas**
- **localStorage**
- external icon / font assets via CDN

### File Structure

```text
azureTopology
├── index.html
├── README.md
├── nextsteps.md
├── js
│   ├── main.js
│   ├── state-management.js
│   ├── canvas-engine.js
│   ├── ui-components.js
│   ├── export-logic.js
│   └── template-gallery.js
└── styles
    └── main.css
```

### What each module does

- **main.js**: application bootstrapping and global bindings
- **state-management.js**: state, resource catalog, persistence, pricing data
- **canvas-engine.js**: rendering and layout logic
- **ui-components.js**: sidebars, editors, interactions, security panel, mobile behavior
- **export-logic.js**: PNG / JSON / PowerShell / Bicep export and import flows
- **template-gallery.js**: ready-made templates and quick-start architectures

---

## 🔍 Why it's practically useful

The project is useful when you want to:

- quickly set up an **Azure design workshop**
- turn requirements into a diagram without starting from a blank page
- discuss architecture options with a client or team
- get a first draft of **deployment artifacts**
- see if a solution makes sense from a **network topology** perspective
- document an existing Azure deployment in a more understandable format
- have a fast, portable solution that opens everywhere with zero setup

---

## ⚠️ Current Status of the Project

### Already included

- fully functional visual builder
- import / export flows
- template gallery
- cost estimator
- security posture panel
- mobile navigation support
- auto-save
- PowerShell and Bicep generation

### Not yet included

- backend or collaboration layer
- CI/CD pipeline
- automated test suite
- package manager / build tooling
- Terraform export

---

## 🗺️ Roadmap

For next steps:

- **[RoadMap.md](./RoadMap.md)**

---

## ❤️ Summary

The **Azure Architecture Builder** is a practical tool for taking an idea to an organized Azure topology with:

- clean visualization
- rapid experimentation
- better architecture discussions
- awareness of cost and security
- initial generation of deployment artifacts

If the goal is to design, explain, and prepare Azure architectures faster and more cleanly, this is exactly the problem it solves.
