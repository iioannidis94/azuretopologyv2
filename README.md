# ☁️ Azure Architecture Builder

Το **Azure Architecture Builder** είναι ένα αναλυτικό, οπτικό εργαλείο σχεδιασμού Azure αρχιτεκτονικών που τρέχει **100% client-side** μέσα στον browser. Σου επιτρέπει να χτίζεις γρήγορα διαγράμματα για **Hub & Spoke**, **Landing Zones**, **Hybrid topologies**, **application platforms** και **data / AI workloads**, ενώ ταυτόχρονα παράγει πρακτικά outputs όπως **PNG**, **JSON**, **Azure PowerShell** και **Bicep**.

Η εφαρμογή είναι φτιαγμένη με **Vanilla JavaScript**, **HTML5 Canvas**, **ES Modules** και **CSS3**, χωρίς backend και χωρίς build process. Ανοίγεις το project και ξεκινάς αμέσως.

---

## 🎯 Τι λύνει αυτό το project

Το project δημιουργήθηκε για να καλύψει ένα πολύ συγκεκριμένο κενό:

- Ο παραδοσιακός σχεδιασμός σε Visio, Draw.io ή PowerPoint είναι καλός για documentation, αλλά δεν σε βοηθά να περάσεις εύκολα από το διάγραμμα στην υλοποίηση.
- Σε πολύπλοκες Azure αρχιτεκτονικές είναι εύκολο να χαθεί η συνολική εικόνα ανάμεσα σε subscriptions, resource groups, VNets, subnets και services.
- Η πρόχειρη εκτίμηση κόστους, η ασφάλεια και η επαναχρησιμοποίηση patterns συνήθως γίνονται αποσπασματικά και αργά.
- Η εισαγωγή υφιστάμενων Azure resources σε ένα καθαρό diagram είναι συχνά χειροκίνητη και χρονοβόρα.

### Με μία πρόταση
Το Azure Architecture Builder συνδυάζει **visual design**, **Azure-aware modeling**, **cost awareness**, **security hints**, **template-based acceleration** και **IaC export** σε μία μόνο στατική εφαρμογή.

---

## 👥 Σε ποιους απευθύνεται

- **Cloud Architects** που θέλουν γρήγορο σχεδιασμό και παρουσίαση λύσεων
- **DevOps / Platform Engineers** που θέλουν αρχικό deployment scaffold
- **Presales / Solution Engineers** που θέλουν να δείξουν γρήγορα topology options
- **Consultants / MSP teams** που δουλεύουν με πολλά subscriptions και landing zones
- **Engineering teams** που θέλουν κοινή οπτική γλώσσα για Azure infrastructure

---

## 🧩 Τι μπορείς να μοντελοποιήσεις

Η εφαρμογή οργανώνει την αρχιτεκτονική σε πραγματική Azure λογική:

- **Subscriptions**
- **Resource Groups**
- **Hub VNet**
- **Spoke VNets**
- **Subnets**
- **Resources σε subnet επίπεδο**
- **Resources σε resource-group επίπεδο**
- **On-premises / hybrid connectivity**
- **VNet peerings**

Αυτό σημαίνει ότι δεν σχεδιάζεις απλώς κουτάκια, αλλά μια δομή που ακολουθεί πραγματικά το Azure operational model.

---

## ✅ Βασικές δυνατότητες

### 1. Visual Azure architecture design

- Δημιουργία και διαχείριση **subscriptions**, **resource groups**, **VNets** και **subnets**
- Υποστήριξη για **Hub & Spoke** αρχιτεκτονικές
- Υποστήριξη για **hybrid scenarios** με on-premises datacenter
- **Any-to-any peering** μεταξύ VNets
- Επεξεργασία ονομάτων και ιδιοτήτων απευθείας μέσα από το UI
- Επιλογή στοιχείων και γρήγορη ενημέρωση properties από τον δεξί editor

### 2. Υποστήριξη πολλών Azure resource types

Οι πόροι είναι οργανωμένοι σε κατηγορίες:

- **Compute**: Virtual Machine, VM Scale Set, AKS, Function App, Container Apps
- **Networking**: Azure Firewall, FortiGate NVA, App Gateway, Load Balancer, VPN Gateway, ExpressRoute Gateway, Azure Bastion, Front Door, Private Endpoint, Private DNS Zone, Public DNS Zone, NSG
- **Data & Storage**: Azure SQL, Cosmos DB, Storage Account, Azure Cache for Redis, Data Lake
- **Security**: Key Vault
- **Integration**: App Service, API Management, Service Bus, Event Hub, Logic App
- **AI & Analytics**: AI Foundry, Azure OpenAI
- **Management**: Azure Monitor

Κάθε resource type συνοδεύεται από:

- default configuration
- ενδεικτικό monthly cost
- icon mapping
- category mapping
- properties για editing από το UI

### 3. Canvas interaction και productivity

- **Drag & drop** μετακίνηση στοιχείων
- **Group drag** για μετακίνηση ολόκληρων containers μαζί με τα παιδιά τους
- **Pan & zoom** στον καμβά
- **Fit to screen**
- **Grid layout** και **Radial layout**
- **Inline rename**
- **Theme toggle**
- **Desktop και mobile panel navigation**

### 4. Undo / Redo history

Η εφαρμογή περιλαμβάνει κανονικό history workflow:

- **Undo**
- **Redo**
- keyboard shortcuts
- υποστήριξη για αλλαγές όπως add, remove, move, rename και topology updates

### 5. Cost awareness

Υπάρχει ενσωματωμένο **Cost Estimator** που:

- υπολογίζει εκτιμώμενο μηνιαίο κόστος
- ενημερώνεται δυναμικά καθώς αλλάζει το διάγραμμα
- μπορεί να σε οδηγήσει στο **Azure Pricing Calculator**

### 6. Security posture visibility

Το **Security Posture panel** δίνει άμεσο feedback για βασικά θέματα αρχιτεκτονικής, όπως:

- πιθανές ελλείψεις σε network isolation
- missing private connectivity όπου έχει νόημα
- best-practice προτάσεις για ορισμένους πόρους
- συνοπτικό security score / health view

### 7. JSON import / export

Μπορείς να:

- εξάγεις το τρέχον diagram σε **JSON**
- εισάγεις diagram από **JSON file**
- κάνεις import από pasted JSON
- βλέπεις preview και validation πριν την αντικατάσταση του υπάρχοντος diagram
- **merge** εισαγόμενα resources στο υπάρχον diagram (αντί για αντικατάσταση)

### 8. Azure inventory import

Η εφαρμογή υποστηρίζει import από πραγματικό Azure inventory μέσω:

- `az resource list`
- `az graph query`
- `Get-AzResource`

Το import flow περιλαμβάνει:

- file upload ή paste JSON
- preview πριν την εισαγωγή
- mapping Azure resource types σε supported visual resources
- ανακατασκευή hierarchy με βάση subscriptions, resource groups και network context
- **merge option** για προσθήκη resources στο υπάρχον diagram χωρίς αντικατάσταση

### 9. IaC & artifact generation

Μπορείς να παράγεις:

- **PNG** για documentation ή παρουσιάσεις
- **JSON** για αποθήκευση / ανταλλαγή diagrams
- **Azure PowerShell deployment script**
- **Bicep template**

Αυτό κάνει το εργαλείο χρήσιμο όχι μόνο για visualization αλλά και για **handover προς implementation**.

### 10. Template Gallery

Η εφαρμογή περιλαμβάνει έτοιμα πρότυπα για γρήγορο ξεκίνημα:

- **Hub & Spoke Basic**
- **Multi-Region DR**
- **Web App + Database**
- **AKS Networking**
- **Landing Zone (CAF)**

Τα templates επιταχύνουν το prototyping και δίνουν κοινά starting points για συχνά Azure patterns.

### 11. Auto-save και state persistence

- Οι αλλαγές αποθηκεύονται αυτόματα στο **localStorage**
- Το project θυμάται την κατάσταση του diagram χωρίς backend
- Υπάρχουν actions για reset diagram και reset custom positions

---

## 🛠️ Αναλυτικό functional scope

### Architecture hierarchy

Το εργαλείο δεν σταματά σε απλά αντικείμενα. Σου επιτρέπει να εκφράσεις:

- tenant-like organization μέσω πολλαπλών subscriptions
- resource placement ανά RG
- network boundaries ανά VNet / subnet
- peerings μεταξύ isolated environments
- hybrid entry points μέσω VPN / ExpressRoute
- deployment segmentation για app, data, security και management layers

### Properties editor

Από το δεξί panel μπορείς να παραμετροποιήσεις:

- ονόματα και metadata
- Azure region / location
- CIDR blocks
- subnet definitions
- peering configuration
- tags
- resource-specific properties όπως SKU, tier, version, replicas, TLS settings, identities, backup, retention, access policies και πολλά ακόμη

### Resource-group level modeling

Δεν περιορίζεσαι μόνο σε subnet-based resources. Υπάρχει υποστήριξη και για πόρους που είναι λογικό να ανήκουν σε επίπεδο **resource group**, όπως DNS zones.

### Network-aware design

Το project δίνει έμφαση σε αρχιτεκτονικές όπου η δικτύωση είναι κεντρικό κομμάτι:

- hub-spoke segmentation
- shared services στο hub
- edge / ingress components
- private connectivity
- DNS dependencies
- firewall / gateway placement

---

## 📦 Τι outputs παίρνεις από το εργαλείο

### Για documentation

- diagram σε PNG
- καθαρό visual topology για design reviews
- artifact για proposals, HLDs και workshops

### Για engineering handoff

- JSON representation του diagram
- αρχικό **PowerShell deployment script**
- αρχικό **Bicep template**

### Για discovery / reverse modeling

- import από Azure inventory
- μετατροπή υπάρχοντος environment σε visual layout

---

## 🚀 Γρήγορη εκκίνηση

Δεν χρειάζεται εγκατάσταση.

### Επιλογή 1: Άμεσο άνοιγμα

Άνοιξε το αρχείο:

```bash
open index.html
```

ή σε Linux:

```bash
xdg-open index.html
```

### Επιλογή 2: Τοπικό static server

```bash
cd <project-directory>
python -m http.server 8000
```

Έπειτα άνοιξε το:

```text
http://localhost:8000
```

Η δεύτερη επιλογή είναι πρακτική επειδή το project χρησιμοποιεί **ES modules**.

---

## 📚 Ενδεικτικό workflow χρήσης

1. Δημιουργείς ή οργανώνεις τα **Subscriptions**
2. Προσθέτεις τα κατάλληλα **Resource Groups**
3. Χτίζεις το **Hub VNet**
4. Προσθέτεις **Spoke VNets**
5. Ορίζεις **Subnets**
6. Τοποθετείς **Azure resources**
7. Ρυθμίζεις **peerings**, hybrid σύνδεση και resource properties
8. Ελέγχεις **cost** και **security posture**
9. Κάνεις refine το layout
10. Εξάγεις **PNG / JSON / PowerShell / Bicep**

---

## ⌨️ Keyboard shortcuts

- **Delete / Backspace**: διαγραφή επιλεγμένου στοιχείου
- **Escape**: αποεπιλογή ή κλείσιμο modal
- **Arrow Keys**: μικρές μετακινήσεις
- **+ / =**: zoom in
- **-**: zoom out
- **Ctrl/⌘ + 0**: fit to screen
- **Ctrl/⌘ + Z**: undo
- **Ctrl/⌘ + Y**: redo
- **?**: άνοιγμα shortcut help panel

---

## 🧱 Τεχνολογική προσέγγιση

Το project είναι **zero-dependency static SPA**.

### Stack

- **HTML5**
- **CSS3**
- **Vanilla JavaScript (ES Modules)**
- **HTML5 Canvas**
- **localStorage**
- εξωτερικά icon / font assets μέσω CDN

### Δομή αρχείων

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

### Τι κάνει κάθε module

- **main.js**: application bootstrapping και global bindings
- **state-management.js**: state, resource catalog, persistence, pricing data
- **canvas-engine.js**: rendering και layout logic
- **ui-components.js**: sidebars, editors, interactions, security panel, mobile behavior
- **export-logic.js**: PNG / JSON / PowerShell / Bicep export και import flows
- **template-gallery.js**: έτοιμα templates και quick-start architectures

---

## 🔍 Γιατί είναι χρήσιμο στην πράξη

Το project είναι χρήσιμο όταν θέλεις:

- να στήσεις γρήγορα ένα **Azure design workshop**
- να μετατρέψεις requirements σε diagram χωρίς να ξεκινήσεις από λευκή σελίδα
- να συζητήσεις architecture options με πελάτη ή ομάδα
- να έχεις πρώτη εκδοχή **deployment artifacts**
- να δεις αν μια λύση είναι λογική από πλευράς **network topology**
- να καταγράψεις μια υπάρχουσα Azure εγκατάσταση σε πιο κατανοητή μορφή
- να έχεις μια γρήγορη, φορητή λύση που ανοίγει παντού χωρίς setup

---

## ⚠️ Τρέχουσα κατάσταση του project

### Υπάρχουν ήδη

- πλήρως λειτουργικό visual builder
- import / export flows
- template gallery
- cost estimator
- security posture panel
- mobile navigation support
- auto-save
- PowerShell και Bicep generation

### Δεν υπάρχουν ακόμη

- backend ή collaboration layer
- CI/CD pipeline
- automated test suite
- package manager / build tooling
- Terraform export

---

## 🗺️ Roadmap

Για επόμενα βήματα και μελλοντικές επεκτάσεις, δες το:

- **[nextsteps.md](./nextsteps.md)**

---

## ❤️ Συνοπτικά

Το **Azure Architecture Builder** είναι ένα πρακτικό εργαλείο για να περάσεις από την ιδέα σε ένα οργανωμένο Azure topology με:

- καθαρή οπτικοποίηση
- γρήγορο experimentation
- καλύτερη συζήτηση αρχιτεκτονικής
- awareness για κόστος και ασφάλεια
- αρχική παραγωγή deployment artifacts

Αν ο στόχος είναι να σχεδιάζεις, να εξηγείς και να προετοιμάζεις Azure αρχιτεκτονικές πιο γρήγορα και πιο καθαρά, αυτό είναι ακριβώς το πρόβλημα που λύνει.
