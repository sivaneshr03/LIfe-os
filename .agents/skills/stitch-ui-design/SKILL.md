---
name: stitch-ui-design
description: Work with StitchMCP to inspect, generate, and edit UI designs, list projects and screens, manage design systems, and translate Stitch designs into production React and Tailwind CSS components.
---

# Stitch UI Design & MCP Integration

This skill guides agents in interacting with Google Stitch via the lazy-loaded `StitchMCP` server. It covers listing projects, inspecting generated screens, triggering text-to-UI screen generation, managing design systems (`design.md`), and translating Stitch designs into accessible, responsive React 19 + Tailwind CSS code.

---

## 1. StitchMCP Calling Convention

All Stitch operations are lazy-loaded through the `call_mcp_tool` interface:

```typescript
call_mcp_tool({
  ServerName: "StitchMCP",
  ToolName: "<tool_name>",
  Arguments: { ... },
  toolSummary: "...",
  toolAction: "..."
});
```

> [!NOTE]
> Parameter formats vary:
> - `get_project` requires the full resource name: `"projects/{projectId}"`
> - `list_screens` and `generate_screen_from_text` take `projectId` **without** the `projects/` prefix.
> - `get_screen` requires the full resource name: `"projects/{projectId}/screens/{screenId}"`.

---

## 2. User's Stitch Project Registry

The following projects are actively configured and accessible:

| Project Title | Project ID | Device | Visibility | Screens | Key Theme / Focus |
|---|---|---|---|---|---|
| **Responsive UI Redesign** | `12878804912045689667` | Desktop | Public | 38 | *Cockpit Bento Minimal* (Geist + Inter, `#6366F1` Indigo) |
| **iamCart Hero Section Variant 1** | `5420721028124767222` | Mobile | Private | 6 | E-commerce mobile hero variations |
| **Hero Page Redesign** | `15767381826337695360` | Mobile | Private | 1 | *Midnight Velocity* (Plus Jakarta Sans + Hanken Grotesk, `#FF7E47` Orange) |
| **Modern Design Refresh** | `13771573677084791157` | Mobile | Private | 27 | *Vibrant Streamer* (Be Vietnam Pro, `#FF5F5D` Coral) |
| **Adaptive Multi-Device UI** | `4687991726405390041` | Mobile | Private | 5 | Multi-device adaptive dashboard layouts |
| **Responsive Web Layout** | `17106898341834217279` | Mobile | Private | 4 | Fluid web layout prototypes |
| **UI Redesign** | `4650092768527145518` | Desktop | Private | 15 | Desktop admin & productivity panels |
| **Multi-Device Responsive Interface** | `11869353848381118568` | Mobile | Private | 12 | Cross-platform showcases |
| **Adaptive Multi-Device UI** | `15003700560127607205` | Mobile | Private | 4 | Compact mobile widgets |
| **Responsive Web Design** | `12484358357607164522` | Mobile | Private | 4 | Web landing & card grids |
| **Responsive Multi-Device Design** | `7849144688566240419` | Mobile | Private | 14 | Responsive design variants |
| **Responsive Quick Billing Interface** | `7320480575272765270` | Desktop | Private | 23 | Financial billing, ledgers & invoices |
| **Unified Cross-Platform Interface** | `6519977040192919993` | Mobile | Private | 42 | Full ecosystem UI components |

---

## 3. Core Workflows & Stitch Tools

### A. Discovering Projects and Screens
1. **List all projects**:
   ```json
   { "ServerName": "StitchMCP", "ToolName": "list_projects", "Arguments": {} }
   ```
2. **List screens in a project**:
   ```json
   { "ServerName": "StitchMCP", "ToolName": "list_screens", "Arguments": { "projectId": "12878804912045689667" } }
   ```
3. **Inspect a screen's code and screenshot**:
   ```json
   {
     "ServerName": "StitchMCP",
     "ToolName": "get_screen",
     "Arguments": {
       "name": "projects/12878804912045689667/screens/052d58515c894e898c1ebe9ba00c2e29"
     }
   }
   ```
   *Output contains `htmlCode`, `cssCode`, and `downloadUrl` for the rendered visual preview.*

### B. Generating New Screens from Text
Use `generate_screen_from_text` to draft a new interface or section:
```json
{
  "ServerName": "StitchMCP",
  "ToolName": "generate_screen_from_text",
  "Arguments": {
    "projectId": "12878804912045689667",
    "prompt": "Create an executive investment portfolio dashboard with asset allocation donut chart, holdings table with unrealized P&L, and instant dry-run CSV ingestion zone.",
    "deviceType": "DESKTOP",
    "modelId": "GEMINI_3_8_FLASH"
  }
}
```

> [!TIP]
> Screen generation may take 1-3 minutes. If the tool call times out, do NOT immediately retry; use `list_screens` or `get_screen` to check if the generated screen completed on the server.

### C. Iterating & Generating Variants
* **Edit existing screen**:
  ```json
  {
    "ServerName": "StitchMCP",
    "ToolName": "edit_screens",
    "Arguments": {
      "projectId": "12878804912045689667",
      "screenIds": ["052d58515c894e898c1ebe9ba00c2e29"],
      "prompt": "Convert the light mode background to sleek dark glassmorphism with emerald accent pills for positive values."
    }
  }
  ```
* **Generate variants**:
  ```json
  {
    "ServerName": "StitchMCP",
    "ToolName": "generate_variants",
    "Arguments": {
      "projectId": "12878804912045689667",
      "screenId": "052d58515c894e898c1ebe9ba00c2e29",
      "variantCount": 3,
      "prompt": "Explore alternative bento grid layouts with varying density."
    }
  }
  ```

### D. Managing Design Systems (`design.md`)
* Use `upload_design_md` or `create_design_system_from_design_md` to apply tokens (colors, typography, radii, spacing) directly from a markdown specification.
* Use `apply_design_system` to propagate design tokens across existing screen instances in a project.

---

## 4. Translating Stitch Designs into React + Tailwind Code

When converting Stitch screen output into the codebase:
1. **Extract HTML & CSS**: Inspect the DOM structure and CSS classes from `get_screen`.
2. **Map Design Tokens**:
   - Convert hex colors (`#6366F1`, `#10B981`, etc.) into semantic Tailwind CSS variable classes (`bg-primary`, `text-emerald-500`, `border-border/80`).
   - Map font families (Geist, Inter) to standard project typography classes.
   - Maintain the Bento grid structure using CSS Grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`).
3. **Componentize**: Split monolithic Stitch screens into atomic React components (`KpiCard`, `DataTable`, `FilterPills`, `ModalSheet`).
4. **State & Interactivity**:
   - Wire static buttons to TanStack Query mutations or Zustand ephemeral state.
   - Add responsive touch targets (`min-h-[44px]` for mobile).
   - Ensure WCAG AA compliance (4.5:1 contrast, semantic heading tags, `aria-label` attributes).
