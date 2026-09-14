# Massachusetts Historical Town Border Map (1620–2020)

An interactive web application for exploring the 400-year evolution of municipal town borders, key historical events, and regional incorporations across Massachusetts.

## Application Architecture

- **Main View (Left 2/3)**:
  - **Map Container**: GPU-accelerated vector map (MapLibre GL JS) rendering town polygon boundaries active in the selected year.
  - **Slider Panel**: Contains a 1620–2020 Horizontal Timeline with 3 Zoom levels (CENTURY, DECADE, YEAR), "Here" Indicator triangle, clustered event circles, and Stepper Controls.
- **Side Panel (Right 1/3)**:
  - **Timeline Panel**: 3-row Event Cards (Date, Content, Footer with Go button) displaying chronological event records.
  - **Library Panel**: Explorer-style file system for reading deep historical notes on notable figures, events, and charters.

## How to Deploy via VS Code & GitHub Pages

1. **Clone Repository**:
   ```bash
   git clone [https://github.com/bgkzero/Town-Map-Tool.git](https://github.com/bgkzero/Town-Map-Tool.git)