# SSManager — 2D Container Planner

A lightweight, responsive, pure HTML/CSS/JavaScript web application (zero external dependencies or bundlers) for creating and managing 2D bird's-eye view shipping yards ("Yards") and arranging shipping containers via interactive drag-and-drop.

---

## Features

* **Multi-Project Management (Yards):**
  * Create, rename, duplicate, and delete multiple yard layouts.
  * Define custom yard dimensions with support for multiple units (**Feet `ft`**, **Meters `m`**, or **Centimeters `cm`**).
* **Container Drag & Drop Palette:**
  * Drag and place standard container sizes: **5 ft**, **10 ft**, **20 ft**, **40 ft**, and **50 ft**.
  * Automatic unit conversion mapping (e.g., placing a 10 ft container in a yard defined in meters automatically converts its physical footprint to `3.048 m`).
* **Interactive SVG Canvas:**
  * Crisp 2D bird's-eye view rendered dynamically via SVG.
  * Responsive scaling that fits the canvas to your screen while keeping grid cells legible.
  * Dynamic scale readout showing grid cell equivalence (e.g., `1 square = 1 ft`).
* **Grid Snapping & Collision Detection:**
  * Toggleable **Snap to Grid** (snaps to 1 unit grid increments).
  * Hard boundary enforcement (prevents containers from leaving the yard area).
  * Real-time overlap/collision checks on drop, move, and rotate with toast feedback.
* **Rotations & Keyboard Shortcuts:**
  * Quick rotation in 90° increments via direct controls or keyboard shortcuts.
  * Fine-grained control with directional arrow nudges.
* **Persistent Storage:**
  * Automatic saving to browser `localStorage` (`yards_v1`) preserves all yards, container positions, units, and selected state across browser refreshes.

---

## Keyboard & Mouse Controls

| Action | Control / Shortcut |
| :--- | :--- |
| **Place Container** | Drag container card from sidebar palette onto the yard canvas |
| **Move Container** | Pointer drag on any container inside the yard |
| **Rotate 90°** | Click the **Blue Handle** on selected container or press <kbd>R</kbd> |
| **Delete Container** | Click the **Red Handle** on selected container or press <kbd>Delete</kbd> / <kbd>Backspace</kbd> |
| **Nudge Container** | Selected container + <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> (nudges by 1 unit step) |
| **Deselect** | Click anywhere on the empty yard background |
