Create a vanilla HTML/CSS/JS app (no frameworks, no bundlers) that lets a user create projects called “Yards” and, inside each yard, drag-and-drop container rectangles (bird’s-eye 2D).

Deliverables (output exactly these files, in this order):

/index.html
/style.css
/script.js


Return each file preceded by a line with exactly === FILENAME ===.

Functional requirements

User can create multiple Yards (projects). Each Yard has a name.

On Create Yard, prompt for yard width and height, then a unit selector: feet (ft), meters (m), or centimeters (cm).

Show the Yard in a 2D bird’s-eye view canvas (SVG or <canvas>; prefer SVG for crisp drag/resize).

Sidebar palette with draggable container types:

5 ft, 10 ft, 20 ft, 40 ft, 50 ft containers.

When a Yard uses non-feet units, convert container sizes correctly:

1 ft = 0.3048 m = 30.48 cm.

Containers appear as labeled rectangles (e.g., “10 ft”) once dropped onto the Yard.

Support drag to move; optional: drag handles to rotate in 90° steps and to delete.

Snap to grid (toggleable). Grid size: 1 ft or equivalent in chosen units.

Yard should scale to fit the viewport while maintaining aspect ratio; show a scale/ruler or scale text (e.g., “1 square = 1 ft”).

Show yard dimensions and current unit on screen.

Projects list on the left/top: create, rename, switch between yards.

Autosave to localStorage (yards, containers, positions, units). Loading the page restores last state.

Interaction details

Drag from sidebar → drop into yard → container is placed at nearest grid snap.

Keyboard:

Delete key removes selected container.

Arrow keys nudge selected container by one grid unit.

R key rotates 90° (if rotation implemented).

Prevent placing containers outside yard bounds (clamp to inside).

Prevent container overlap when dropping/moving (basic collision check); if collision, snap to nearest valid spot or refuse with a subtle UI hint.

UI/UX

Clean, responsive layout: sidebar (palette + yards list) and main canvas.

Accessible: buttons have labels; high-contrast; keyboard focus ring visible.

Display a mini legend for container colors/sizes.

Data model (in script.js)

type Unit = 'ft' | 'm' | 'cm';
type ContainerType = '5ft' | '10ft' | '20ft' | '40ft' | '50ft';

interface Yard {
  id: string;
  name: string;
  width: number;   // in chosen unit
  height: number;  // in chosen unit
  unit: Unit;
  containers: PlacedContainer[];
}

interface PlacedContainer {
  id: string;
  type: ContainerType;
  widthFt: number;    // logical size in feet (5,10,20,40,50)
  x: number;          // position in yard units
  y: number;          // position in yard units
  rotation: 0 | 90;
}


Scaling & units

Keep a logical coordinate system in the Yard’s unit (ft/m/cm).

Map logical units → pixels with a computed scale so the full yard fits with padding and grid cell size ≥ 8 px.

Container rendered width = widthFt converted into yard unit × scale.

Collision & bounds (simplified)

Treat each container as an axis-aligned rect based on rotation; block overlap on move/drop.

On rotate, if it would collide or exceed bounds, reject rotate and show a brief tip.

Persistence

Save an array of Yard objects in localStorage (yards_v1).

Provide buttons: New Yard, Rename, Duplicate, Delete (with confirm).

Active yard id stored in localStorage.

Testing hooks (manual)

Create a Yard 100 ft × 60 ft (ft).

Drop a 40 ft and 20 ft container; ensure snap and no overlap.

Create a Yard 30 m × 20 m (m). Drop a 10 ft container; verify its size is 3.048 m.

Toggle snap; nudge with arrows; rotate with R; delete with Delete.

Non-requirements (keep it simple)

No backend or login.

No external libraries.

Code quality

Comment the conversion/scaling math.

Functions small and named; avoid global leakage; use modules if possible (ES modules).

Output format example

=== /index.html ===
...file contents...
=== /style.css ===
...file contents...
=== /script.js ===
...file contents...
