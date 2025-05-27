![CO2NEX Logo](https://co2nex.org/wp-content/uploads/2025/05/CO2NEX-Real-Time-Carbon-Credit-Verification-Economy.webp)

# CO2NEX Carbon Harvest Calculator (v1.0.0 Beta)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-v1.0.0--beta-important)]()
[![Status](https://img.shields.io/badge/status-active_testing-yellow)]()
[![Form Submission](https://img.shields.io/badge/form_submission-working_with_known_issue-red)]()
[![Verified: Real-Time](https://img.shields.io/badge/Verified-Real--Time-44cc88)]()
[![Open Science](https://img.shields.io/badge/Methodology-Open--Source-blueviolet)]()
[![CO₂ Accuracy](https://img.shields.io/badge/Carbon%20Data-Scientific%20Accuracy-lightgrey)]()

> **Beta Testing Notice**  
> This is the **Beta version (v1.0.0)** of the CO2NEX Carbon Harvest Calculator. The core functionality is operational, but we're actively improving the system.  
> **Known Issue:** Form submission currently fails when text is entered in the name field (will be fixed in v1.0.1).  
> *Your testing feedback is invaluable!* Report issues at [social@co2nex.org](mailto:social@co2nex.org)

---

## 🌱 Discover Your Land's Carbon Potential

**The CO2NEX Carbon Harvest Calculator** is the first scientifically-validated tool that gives landowners **instant estimates** of their property's carbon credit potential and financial value.

> "Empowering landowners to monetize conservation through transparent carbon accounting."

### 🔄 What's New in v1.0.0 Beta
- ✅ **Form submission working** (except known name field issue)
- 📝 **Enhanced informational text** explaining calculator purpose
- 🚨 **Clear version tagging** and testing notices
- 🛠️ **Improved error handling** for calculations
- 🌐 **Better mobile responsiveness**

---

## 🧮 How It Works

1. **Enter Your Land Details**  
   - Area size + unit selection
   - Land use type
   - Project duration (optional)

2. **Get Instant Estimates**  
   - Annual carbon sequestration
   - Potential revenue
   - Environmental impact equivalents

3. **Submit for Detailed Assessment**  
   - Connect with CO2NEX experts
   - Begin verification process

---

## 🧪 Scientific Foundation

Our calculations use **peer-reviewed sequestration rates** adapted for Brazilian biomes:

| Land Type | Sequestration Rate (tCO₂e/ha/yr) |
|-----------|----------------------------------|
| Forest Conservation | 1.8 |
| Reforestation | 9.2 |
| Regenerative Agriculture | 1.3 |
| Improved Pasture | 0.9 |
| Wetland Restoration | 6.5 |

*Based on IPCC 2019 Wetlands Supplement and Brazil-specific studies*

---

## 🚧 Current Limitations (Beta)

- Name field breaks form submission (temporary workaround: leave blank)
- Calculations are estimates only
- Limited to Brazilian biome defaults
- No save/export functionality yet

---

## 🛠️ Installation & Usage

```bash
# Clone repository
git clone https://github.com/co2nex/co2nex-platform.git

# WordPress Installation
1. Copy to your theme directory
2. Include via template tag: 
   `<?php get_template_part('carbon-credit-calculator/v1.0.0-beta/template'); ?>`

