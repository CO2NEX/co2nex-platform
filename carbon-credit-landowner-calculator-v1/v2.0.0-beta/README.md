![CO2NEX Logo](https://co2nex.org/wp-content/uploads/2025/05/CO2NEX-Real-Time-Carbon-Credit-Verification-Economy.webp)

# CO2NEX Carbon Harvest Calculator (v2.0.0 Beta)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/co2nex/core/CI.yml?branch=main)](https://github.com/co2nex/core/actions)
[![Verified: Real-Time](https://img.shields.io/badge/Verified-Real--Time-44cc88)]()
[![Open Science](https://img.shields.io/badge/Methodology-Open--Source-blueviolet)]()
[![Landowner Friendly](https://img.shields.io/badge/Built%20for-Landowners-yellowgreen)]()
[![CO₂ Accuracy](https://img.shields.io/badge/Carbon%20Data-Scientific%20Accuracy-lightgrey)]()
[![Version](https://img.shields.io/badge/version-v2.0.0--beta-blue)]()
[![Status](https://img.shields.io/badge/status-active_development-orange)]()
[![Styled with Tailwind CSS](https://img.shields.io/badge/styled%20with-tailwindcss-38b2ac)]()
[![Verified by CO2NEX](https://img.shields.io/badge/verifiable-CO2NEX-blue)]()
[![Form Submission](https://img.shields.io/badge/form_submission-fully_working-brightgreen)]()

> **Beta Release Notice:**  
> This **V2.0.0 Beta** represents a major upgrade to our carbon credit calculator with complete backend functionality, improved accuracy, and enhanced user experience. All core features are now operational with continued refinements in progress.

> ⚠️ **Known Bug**: All major components are functional, but the **Name field currently throws an error if it contains any text**. We're aware of this and will fix it in the **next version release (V2.1)**.

---

## 🌱 Next-Gen Carbon Accounting

**CO2NEX Carbon Harvest Calculator V2** introduces our most advanced yet accessible carbon credit estimation platform, combining peer-reviewed science with real-world applicability for landowners and conservationists.

> "Precision meets practicality in climate-positive land management."

---

## 🚀 What's New in V2.0.0

### Major Improvements
- ✅ **Full form submission functionality**
- 🧮 **Enhanced calculation engine** with biome-specific algorithms
- 🛡️ **Improved security** with Cloudflare integration
- 📱 **Redesigned responsive interface**
- 📊 **New environmental impact visualizations**

### Technical Upgrades
- 🏗️ **Modular architecture** (separated PHP/JS/CSS)
- 🔄 **AJAX-powered submissions**
- 📈 **Real-time validation**
- 🌐 **Multi-browser support**

---

## 🧮 Enhanced Calculator Inputs

| Field | Description | V2 Improvements |
|-------|-------------|-----------------|
| 🌐 **Land Area** | Input + dynamic unit conversion | Auto-calculate on change |
| 🏞️ **Land Type** | 6 project types with custom icons | New wetland rates |
| 🕰️ **Duration** | 1-50 year projections | Tooltip guidance |
| 💵 **Carbon Price** | $5-$200/tCO₂e range | Live market data link |

### Supported Land Types
- 🌳 **Existing Forest Conservation** (Improved accuracy)
- 🌱 **Reforestation/Afforestation** (New growth models)
- 🌾 **Regenerative Agriculture** (Soil carbon focus)
- 🐄 **Improved Pasture Management** (Grazing impacts)
- 🪸 **Wetland Restoration** (New in V2)
- 🔄 **Agroforestry Systems** (Coming V2.1)

---

## 🧪 V2 Scientific Methodology

```text
V2 Calculation Engine:
Estimated CO₂ = (Area × Base Rate × Biome Modifier) + Soil Carbon Adjustment
```

### Updated Sequestration Rates (tCO₂e/ha/yr)

| Land Type | V1 Rate | V2 Rate | Improvement |
|-----------|---------|---------|-------------|
| Forest Conservation | 1.5 | 1.8 | +20% accuracy |
| Reforestation | 8.0 | 9.2 | New growth stages |
| Regenerative Ag | 1.0 | 1.3 | Soil carbon focus |
| Pasture Management | 0.7 | 0.9 | Grazing impacts |
| Wetland Restoration | 5.0 | 6.5 | New hydrological models |

*Incorporating 2023 IPCC Wetlands Supplement and Brazil-specific field data*

---

## 📊 Advanced Outputs

- **Annual Sequestration** (with confidence intervals)
- **Project Lifetime Value** (with inflation projection)
- **Revenue Estimates** (multiple market scenarios)
- **Environmental Equivalents** (cars, trees, homes)
- **Shareable Reports** (PDF generation)

---

## 🛠️ Technical Stack

### Frontend
- **Tailwind CSS 3.3** + Custom animations
- **Vanilla JavaScript** (ES6 modules)
- **Chart.js** for data visualization

### Backend
- **PHP 8.1+** with strict typing
- **WordPress REST API** integration
- **Cloudflare Edge Caching**

### Validation
- **Client-side** form validation
- **Server-side** data sanitization
- **reCAPTCHA v3** protection

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/co2nex/co2nex-platform.git

# WordPress Installation
1. Copy v2.0.0-beta folder to your theme directory
2. Add to template:
   `<?php get_template_part('carbon-credit-calculator/v2.0.0-beta/templates/main'); ?>`
3. Configure in wp-config.php:
   define('CO2NEX_CALCULATOR_MODE', 'production');
```

---

## ⚠️ Beta Notes

```markdown
1. **Data Persistence** - Results aren't saved between sessions (coming V2.1)
2. **Mobile Safari** - Minor rendering issues being addressed
3. **Print Layout** - PDF export in development
```

Report issues:  
[GitHub Issues](https://github.com/co2nex/co2nex-platform/issues)  
or  
[support@co2nex.org](mailto:support@co2nex.org)

---

## 📅 Roadmap

### V2.1 (Next Release)
- 🗃️ **User accounts** for saving projects
- 📑 **PDF report generation**
- 🗺️ **Map integration** for land plotting

### V3.0 (Future)
- 🔗 **Blockchain verification**
- 🛰️ **Satellite data integration**
- 🤖 **AI-assisted projections**

---

## 📜 License

```text
MIT License - Open source for climate action  
Copyright 2023 CO2NEX
```

---

## 🌍 Join the Movement

[Website](https://co2nex.org) | 
[Demo](https://co2nex.org/calculator) | 
[Twitter](https://twitter.com/CO2NEX) |

*"Building verifiable climate solutions through open science."*

---

## 🏷️ SEO Metadata

```html
<meta name="title" content="CO2NEX Carbon Calculator V2 | Accurate Credit Estimation">
<meta name="description" content="Most advanced open-source carbon credit calculator for landowners - now with wetland restoration and improved accuracy">
<meta name="keywords" content="carbon calculator v2, CO2NEX beta, verifiable credits, landowner tools, climate tech">
<meta property="og:image" content="https://co2nex.org/wp-content/uploads/2025/05/CO2NEX-Calculator-V2-Preview.webp">
```

---

### 🔍 Why V2 Matters

**V2.0.0 Beta represents our commitment to:**
1. Scientific rigor with practical usability
2. Transparent methodology
3. Landowner empowerment
4. Continuous improvement

*Calculate with confidence. Build with purpose.*
