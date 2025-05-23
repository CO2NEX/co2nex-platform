---
title: Mato Grosso Alpha Dashboard
layout: default
---

# 🌍 CO2NEX | Mato Grosso Environmental Dashboard  
**Version: V1.0.0 Alpha**  

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Earth Engine](https://img.shields.io/badge/Built%20with-Google%20Earth%20Engine-34A853?logo=google-earth)](https://earthengine.google.com/)
[![CO₂ Verification](https://img.shields.io/badge/Verification-Real%20Time%20Carbon%20Credits-green)](https://co2nex.org)
[![AI Blockchain](https://img.shields.io/badge/Tech-AI%20%7C%20Blockchain%20%7C%20Satellites-blueviolet)](#)
[![Status](https://img.shields.io/badge/Status-Alpha-yellow)](#versioning)
[![GitHub issues](https://img.shields.io/github/issues/CO2NEX/environmental-dashboard)](https://github.com/CO2NEX/environmental-dashboard/issues)
[![Website](https://img.shields.io/badge/Visit-co2nex.org-brightgreen)](https://co2nex.org)

> **CO2NEX** is the world’s only real-time carbon credit **verification & certification nonprofit** using **AI, blockchain, and satellite intelligence** to validate environmental impact.

---

## 🧭 Project Overview

The **Mato Grosso Environmental Dashboard** is an open-source **geospatial verification template** developed by **[CO2NEX](https://co2nex.org)**. It allows real-time monitoring (This version is for testing of static 2022 satalite image and GIS data) of ecological integrity and regenerative land practices across properties in Mato Grosso, Brazil.

This project is the **alpha release** of CO2NEX's landowner validation tools for nature-based solutions.

---

## 🌐 What Is CO2NEX?

> **CO2NEX** is a nonprofit foundation pioneering **real-time carbon credit verification**, with end-to-end transparency and traceability.  
We combine **AI, blockchain, and orbital data** to validate the world’s carbon impact—**live**.

- 🛰️ Satellite-verified environmental conditions
- 🧠 AI-driven carbon baselining & risk profiling
- 🔗 Blockchain-anchored audit trails
- 🤝 Human-trusted certification, digitized

🌍 Learn more: [co2nex.org](https://co2nex.org)

---

## 🧪 Dashboard Features

- ✅ **NDVI** (Vegetation productivity)
- ✅ **Soil Moisture** (Topsoil health via SMAP)
- ✅ **Water Occurrence** (JRC Surface Water)
- ✅ **Soil Carbon** (ISRIC SoilGrids 0–100cm SOC)
- ✅ **Carbon Emission Risk** (Deforestation + biomass loss via UMD Hansen)
- ✅ **Modular for Custom Landowners**
- ✅ **Public, Transparent, Verified Datasets**
- ✅ **Google Earth Engine Integrated**

---

## 📦 How to Use This Template

This dashboard runs in [Google Earth Engine](https://earthengine.google.com/).

#### 🛠️ Deploy:

1. Sign up for a GEE account at [signup.earthengine.google.com](https://signup.earthengine.google.com/)
2. Open the [GEE Code Editor](https://code.earthengine.google.com/)
3. Copy/paste [`index.js`](https://github.com/CO2NEX/dashboards/mato-grosso-alpha/index.js)
4. Modify the default geometry with your region or land boundary
5. Run layers and observe environmental KPIs in real time

> 🔁 Fork the repo to clone your own environmental dashboard for any region

---

## 🛰️ Data Layers & Sources

| Layer | Dataset | Description |
|-------|---------|-------------|
| **NDVI** | NOAA VIIRS VNP13A1 | Vegetation Index |
| **Soil Moisture** | NASA SMAP | Surface moisture (10 km resolution) |
| **Water** | JRC Surface Water | 1984–2020 water occurrence frequency |
| **Soil Carbon** | ISRIC SoilGrids | SOC stock (0–100cm) |
| **Carbon Emission Risk** | UMD Hansen | Tree loss & potential CO₂ emissions |

> 📌 All datasets are sourced from trusted, open satellite archives on Google Earth Engine.

---

## 📁 Folder Structure

├── README.md               # This documentation
├── index.js                # Earth Engine Script
├── LICENSE                 # MIT License
├── /docs                   # Coming soon: Dataset methods & metadata
└── /landowners             # Placeholders for customized project maps

---

## 🌿 Environmental Impact Use Cases

- 🔎 **Real-time monitoring** of carbon sink regions
- 📈 **Baseline & additionality** validation for offset projects
- 🌾 Support for **landowners & indigenous territories**
- 💸 Environmental due diligence for **investors and VC funds**
- 📜 Carbon audit reports for **certification partners**

---

## 🧩 Versioning & Roadmap

**Current:** `V1.0.0 Alpha`

#### Next Milestones:
- Modular dashboard builder
- CSV + PDF verification reports
- Tokenized carbon certificate prototypes
- Export to GIS + WebMap platforms (QGIS, Power BI)

---

## 🤝 Contributing

We welcome all contributors, Earth Engine developers, data scientists, and environmental advocates.

- 🐛 Found a bug? [Open an issue](https://github.com/CO2NEX/environmental-dashboard/issues)
- 🌱 Want to support? Fork the repo or share our mission
- 🧪 Propose new satellite layers or AI integrations

---

## 🔗 Connect With Us

> **Team Lead:** [@EJCO2NEX](https://github.com/EJCO2NEX)  
> **Foundation:** [co2nex.org](https://co2nex.org)  
> **Email:** social@co2nex.org  
> **Nonprofit:** Verified 501(c) organization *(International model in progress)*

Stay updated on [Instagram](https://instagram.com/co2nex), [Carbon Credit News](https://co2nex.org/blog/), and more soon.

---

## 📄 License

MIT License © 2025 CO2NEX Foundation  
See [`LICENSE`](LICENSE) for details.

---

## 🔍 SEO Keywords (for GitHub + Google)

`carbon credit verification`, `real-time carbon monitoring`, `AI carbon credits`, `satellite verification`, `CO2 certification`, `blockchain climate registry`, `regenerative agriculture monitoring`, `NDVI dashboard`, `soil carbon Brazil`, `open source Earth Engine`, `climate finance tools`, `nature-based solutions`, `CO2NEX environmental`

---
