# ☁️ Azure Architecture Builder

**Azure Architecture Builder** is a comprehensive, visual Azure architecture design tool that runs **100% client-side** in your browser. It allows you to rapidly build and visualize **Hub & Spoke**, **Landing Zones**, **Hybrid topologies**, **application platforms**, and **data/AI workloads**, while instantly generating practical artifacts like **PNG**, **JSON**, **Azure PowerShell scripts**, and **Bicep templates**.

Built entirely with **Vanilla JavaScript**, **HTML5 Canvas**, **ES Modules**, and **CSS3**, it requires no backend, no dependencies, and no build process. Just open the file and start designing.

---

## 🎯 The Problem It Solves

Traditional diagramming tools (like Visio, Draw.io, or PowerPoint) are great for documentation but fail to bridge the gap between design and implementation. On the other hand, navigating complex Azure environments via the portal can cause you to lose sight of the overall network topology.

**Azure Architecture Builder** combines visual design with Azure-aware modeling, cost awareness, security insights, and Infrastructure as Code (IaC) generation into a single, lightning-fast static application.

---

## 👥 Who is this for?

* **Cloud Architects** needing rapid prototyping and visual design reviews.
* **DevOps / Platform Engineers** looking to generate initial deployment scaffolds (Bicep/PowerShell) from a visual layout.
* **Presales / Solution Engineers** wanting to quickly demonstrate topology options and cost estimates to clients.
* **Consultants / MSPs** working across multiple subscriptions and landing zones.

---

## ✅ Key Features & Capabilities

### 1. Visual Azure Architecture Design
* **Native Azure Hierarchy:** Model Subscriptions, Resource Groups, Hub VNets, Spoke VNets, and Subnets.
* **Topology Support:** Out-of-the-box support for Hub & Spoke and Hybrid (On-Premises / Datacenter) connectivity.
* **Network-Aware Routing:** Map Any-to-Any VNet peerings and Private DNS Zone VNet Links.
* **Interactive Canvas:** Drag & drop elements, group dragging, pan & zoom, fit-to-screen, and inline renaming (double-click).
* **Dual Layouts:** Switch instantly between Grid and Radial topologies.
* **Dark & Light Modes:** Built-in theming (including a "Draw.io" style light theme).

### 2. Template Gallery 🆕
Quick-start your designs using built-in, best-practice architecture templates:
* **Hub & Spoke Basic:** Classic network topology with Azure Firewall and VPN.
* **Multi-Region DR:** Primary/Secondary regions with Traffic Manager and geo-replicated DBs.
* **Web App + Database:** Three-tier web architecture with App Gateway and WAF.
* **AKS Networking:** Production AKS cluster with Azure CNI, Key Vault, and monitoring.
* **Landing Zone (CAF):** Cloud Adoption Framework structure with management, connectivity, and workload subscriptions.

### 3. Infrastructure as Code (IaC) & Artifact Export
Export your visual diagram directly into usable code:
* **Bicep Templates:** Generates `.bicep` files reflecting your resources and network topology.
* **Azure PowerShell:** Generates a `.ps1` deployment script using `Az` modules.
* **JSON:** Export the exact state for sharing or version control.
* **PNG:** High-resolution (2x) image export for documentation and presentations.

### 4. Azure Inventory Import & Diagram Merging 🆕
Reverse-engineer existing environments by importing real Azure data:
* Import JSON outputs from `az resource list`, `az graph query`, or PowerShell `Get-AzResource`.
* Auto-detects Management Groups, Subscriptions, Resource Groups, and VNet/Subnet mapping.
* **Merge Capability:** Add imported resources into your existing canvas diagram without overwriting your current work.

### 5. Live Cost Estimator
* Calculates an estimated monthly cost based on the resources in your diagram.
* Updates dynamically as you add/remove resources or change SKUs.
* One-click deep link to the **Azure Pricing Calculator** pre-populated with your chosen services.

### 6. Security Posture Visibility
An automated Security Posture panel analyzes your diagram and provides real-time feedback:
* Flags missing Network Security Groups (NSGs).
* Recommends Private Endpoints for PaaS services (SQL, Key Vault, Storage).
* Warns about missing Web Application Firewalls (WAF) or Hub Firewalls.
* Validates VNet peering and Gateway configurations.

### 7. Rich Productivity Tooling
* **Full Undo / Redo Stack:** Safely revert mistakes with Ctrl+Z / Ctrl+Y.
* **Keyboard Shortcuts:** Navigate and edit at the speed of thought.
* **Auto-Save:** Your state is continuously persisted in the browser's `localStorage`.
* **Properties Editor:** Live-edit names, CIDR blocks, locations, SKUs, and Azure-specific properties via a dedicated side panel.

---

## 🧩 Supported Azure Resources

The tool supports over 35 distinct resource types, meticulously mapped to official Azure SVG icons, grouped by category:

* **Compute:** Virtual Machine, VM Scale Set, AKS, Function App, Container Apps
* **Networking:** Azure Firewall, FortiGate NVA, App Gateway, Load Balancer, VPN Gateway, ExpressRoute Gateway, Azure Bastion, Front Door, Private Endpoint, Private DNS Zone, Public DNS Zone, NSG
* **Data & Storage:** Azure SQL, Cosmos DB, Storage Account, Azure Cache for Redis, Data Lake
* **Security:** Key Vault
* **Integration:** App Service, API Management, Service Bus, Event Hub, Logic App
* **AI & Analytics:** AI Foundry, Azure OpenAI
* **Management:** Azure Monitor (Log Analytics)
