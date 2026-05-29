# ☁️ Azure Architecture Builder 

Ένα δυναμικό, διαδραστικό web εργαλείο (Single-Page Application) για τον σχεδιασμό, την οπτικοποίηση και την εξαγωγή αρχιτεκτονικών **Microsoft Azure** (Hub & Spoke / Enterprise Scale). Φτιαγμένο εξ ολοκλήρου με **Vanilla JavaScript, HTML5 Canvas και CSS3**, χωρίς εξωτερικές βιβλιοθήκες.

Το εργαλείο επιτρέπει στους Cloud Architects και τους DevOps Engineers να στήνουν γρήγορα πολύπλοκα δίκτυα, να παραμετροποιούν πόρους και να παράγουν αυτόματα κώδικα υποδομής (Infrastructure as Code - IaC).

---

## ✨ Βασικά Χαρακτηριστικά (Features)

*   **🌍 Πλήρης Ιεραρχία Azure:** Υποστήριξη πολλαπλών Subscriptions, Resource Groups, VNets (Hub/Spokes), On-Premises Datacenters και επιμέρους Azure Resources.
*   **🆕 Βελτιωμένη Ορατότητα Στοιχείων:** Τα Subnets, Resource Groups και Subscriptions εμφανίζονται με πιο έντονα χρώματα, μεγαλύτερα borders και ευκρινέστερες ετικέτες για εύκολη αναγνώριση στο διάγραμμα.
*   **🎨 Διπλό Οπτικό Θέμα (Themes):** 
    *   **Draw.io / Light Theme:** Επίσημη εταιρική (corporate) απεικόνιση με λευκό φόντο, σκιές και καθαρές γραμμές.
    *   **Dark / Cyberpunk Theme:** Σκοτεινό θέμα υψηλής αντίθεσης για ξεκούραστη νυχτερινή εργασία.
*   **📐 Έξυπνη Μηχανή Διάταξης & Drag and Drop:**
    *   **Grid (Αρχιτεκτονικό):** Οργανώνει τα Resources μέσα σε VNet "κουτιά" (Enterprise Landing Zones).
    *   **Radial (Κυκλικό):** Απεικονίζει το Hub στο κέντρο και τα Spokes κυκλικά γύρω του.
    *   **Freeform Drag & Drop:** Μπορείτε να "πιάσετε" (click & drag) οποιοδήποτε δίκτυο ή resource και να το τοποθετήσετε όπου ακριβώς θέλετε στον καμβά!
    *   **🆕 Group Drag (Resource Group):** Κάνοντας drag σε ένα Resource Group box, μετακινούνται **όλα** τα VNets, Subnets και Resources που περιέχει μαζί του.
    *   **🆕 Group Drag (Subscription):** Κάνοντας drag σε ένα Subscription box, μετακινείται ολόκληρη η ιεραρχία (RGs, VNets, resources) μαζί.
    *   **🆕 VNet Group Drag:** Όταν σύρετε ένα VNet, τα subnets και τα resources μέσα του ακολουθούν αυτόματα.
*   **🔗 Any-to-Any VNet Peering & Hybrid:** Δυνατότητα σύνδεσης οποιουδήποτε VNet με οποιοδήποτε άλλο. Επίσης υποστηρίζεται σύνδεση με **On-Premises** υποδομή μέσω S2S VPN / ExpressRoute.
*   **🖼️ Επίσημα Azure Icons:** Χρήση των πραγματικών SVG λογοτύπων της Microsoft.
*   **💰 Ζωντανή Εκτίμηση Κόστους (Cost Estimator):** Υπολογίζει αυτόματα το εκτιμώμενο μηνιαίο κόστος της υποδομής σας καθώς προσθέτετε ή αφαιρείτε πόρους.
*   **💾 Auto-Save (Τοπική Μνήμη):** Κάθε αλλαγή αποθηκεύεται αυτόματα στον browser (`localStorage`).
*   **⚙️ Live Properties Editor:** Ζωντανή επεξεργασία ρυθμίσεων με άμεση οπτική ενημέρωση του καμβά.
*   **🚀 Εξαγωγή (Export & IaC):** Εξαγωγή σε εικόνα (PNG), καθώς και αυτόματη δημιουργία **PowerShell Script** ή **Bicep Template** για άμεσο deployment.

---

## 🛠️ Πώς Λειτουργεί - Βήμα προς Βήμα

Το περιβάλλον χωρίζεται σε τρεις κύριες στήλες:

### 1. Η Αριστερή Μπάρα (Azure Hierarchy Builder)
Εδώ χτίζετε τη "ραχοκοκαλιά" της υποδομής σας.
*   **Hybrid / On-Premises:** Ενεργοποιήστε το τοπικό σας Datacenter για να σχεδιάσετε υβριδικές αρχιτεκτονικές.
*   **Subscriptions:** Πατήστε *"+ Add Subscription"* για να προσθέσετε νέα συνδρομή.
*   **Resource Groups:** Μέσα σε κάθε Subscription δημιουργείτε πολλαπλά RGs.
*   **VNet & Spokes:** Σε κάθε RG προσθέτετε νέα Spoke VNets.
*   **Resources:** Κάθε VNet έχει ένα μενού *"+ Add Resource"*. Από εκεί ανοίγει μια κατηγοριοποιημένη λίστα για να "ρίξετε" πόρους μέσα στο VNet.

### 2. Ο Κεντρικός Καμβάς (Interactive Canvas)
Ο καμβάς (στη μέση) οπτικοποιεί ζωντανά την αρχιτεκτονική σας.
*   **Πλοήγηση (Pan & Zoom):** Κάντε drag-and-drop στο κενό φόντο για να μετακινηθείτε και scroll για Zoom in/out.
*   **Drag & Drop Πόρων:** Κάντε "αριστερό κλικ και σύρσιμο" πάνω σε ένα VNet ή Resource για να το μετακινήσετε ελεύθερα.
*   **🆕 Group Drag (RG/Subscription):** Κάντε κλικ και σύρσιμο πάνω σε ένα Resource Group ή Subscription box — όλα τα στοιχεία μέσα μετακινούνται μαζί, δίνοντας τη δυνατότητα μαζικής αναδιάταξης.
*   **Επιλογή (Select):** Κάντε κλικ σε οποιοδήποτε εικονίδιο για να εμφανιστούν οι ιδιότητές του δεξιά.
*   **Μετονομασία (Rename):** Κάντε διπλό κλικ πάνω σε οποιοδήποτε όνομα στον καμβά.

### 3. Η Δεξιά Μπάρα (Properties Editor & Cost)
Όταν επιλέγετε ένα στοιχείο, αυτή η μπάρα μετατρέπεται σε κέντρο ελέγχου:
*   **Για VNets:** Αλλάξτε όνομα, CIDR Block, RG. 
*   **Για Peerings:** Θα δείτε μια λίστα με όλα τα υπόλοιπα VNets. Πατώντας το κουμπί `🔗 / 🔌`, μπορείτε να ενώσετε (Peering) ή να αποκόψετε τα δίκτυα.
*   **Cost Estimator:** Στο πάνω μέρος προβάλλεται το συνολικό εκτιμώμενο κόστος.

### 4. Εξαγωγή (Exports)
Στο κάτω δεξί μέρος βρίσκονται τα εργαλεία εξαγωγής:
1.  **⬇ Export as PNG:** Παράγει μια εικόνα υψηλής ανάλυσης (2x Scale) της αρχιτεκτονικής σας.
2.  **⚡ Deploy via PowerShell:** Παράγει έτοιμο `.ps1` script (με RGs, VNets, Peerings, Gateways).
3.  **📄 Generate Bicep:** Παράγει σκελετό κώδικα Bicep.
4.  **🔄 Reset / 🧹 Clear Positions:** Επαναφορά της εφαρμογής ή απλή εκκαθάριση των custom συντεταγμένων του Drag & Drop.

---

## 💻 Τεχνολογίες που Χρησιμοποιήθηκαν (Tech Stack)

Το project ακολουθεί τη λογική **Zero Dependencies** (δεν απαιτεί NPM, React, Vue, ή Node.js).
*   **HTML5 & CSS3:** Σημασιολογική δόμηση, CSS Variables, CSS Grid.
*   **Vanilla JavaScript (ES6+):** HTML5 Canvas API (Αλγόριθμοι σχεδίασης, Orthogonal routing, Drag & Drop), LocalStorage API.
*   **CDN Assets:** Επίσημα Microsoft Azure SVGs.

---

> **Δημιουργήθηκε με μεράκι για την κοινότητα του Cloud & του DevOps!** ☁️
