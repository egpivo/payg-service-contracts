# Figma Design Prompt for Pool Protocol Demo

Use this prompt to generate a professional Figma design for the Pool Protocol demo UI.

## Core Design Principles

- **Clean & Minimal**: Professional, enterprise-grade interface
- **Product-Focused**: Emphasize the "Mobile Library" narrative
- **Clear Hierarchy**: Guide users through the demo flow naturally
- **Trustworthy**: Use established design patterns (no experimental UI)

---

## Design System Specs

### Color Palette

```
Primary Gradient:
- Start: #667eea (Purple-blue)
- End: #764ba2 (Deep purple)

Backgrounds:
- Page Background: #f5f5f5 (Light gray)
- Card Background: #ffffff (White)
- Section Background: #f8f9fa (Off-white)

Text:
- Primary: #1a1a1a (Near black)
- Secondary: #666666 (Medium gray)
- Tertiary: #999999 (Light gray)

Accents:
- Success: #10b981 (Green)
- Error: #ef4444 (Red)
- Info: #3b82f6 (Blue)
- Warning: #f59e0b (Amber)

Borders:
- Default: #e0e0e0 (Light gray)
- Focus: #667eea (Primary)
```

### Typography

```
Font Family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif

Scale:
- H1: 2.5rem (40px), Weight: 700, Line-height: 1.2
- H2: 1.75rem (28px), Weight: 600, Line-height: 1.3
- H3: 1.5rem (24px), Weight: 600, Line-height: 1.4
- Body Large: 1.2rem (19px), Weight: 400, Line-height: 1.6
- Body: 1rem (16px), Weight: 400, Line-height: 1.5
- Small: 0.85rem (14px), Weight: 400, Line-height: 1.5
- Caption: 0.8rem (13px), Weight: 400, Line-height: 1.4
```

### Spacing Scale

```
Base: 8px
- xs: 0.25rem (4px)
- sm: 0.5rem (8px)
- md: 1rem (16px)
- lg: 1.5rem (24px)
- xl: 2rem (32px)
- 2xl: 3rem (48px)
```

### Border Radius

```
- Small: 4px
- Medium: 8px
- Large: 12px
- Full: 9999px (for pills/badges)
```

### Shadows

```
- Card: 0 1px 3px rgba(0, 0, 0, 0.1)
- Elevated: 0 2px 8px rgba(0, 0, 0, 0.1)
- Button: 0 4px 6px rgba(102, 126, 234, 0.3)
```

---

## Page Layout Structure

### Hero Section

**Specs:**
- Full-width container, max-width: 1200px, centered
- Padding: 3rem vertical, 2rem horizontal
- Background: Gradient (Primary gradient)
- Text color: White
- Border radius: 12px
- Margin bottom: 2rem

**Content:**
1. **Title**: "The Mobile Library" - H1, centered
2. **Subtitle**: One-line description (Body Large)
3. **Protocol Mapping Card**: 
   - Background: rgba(255, 255, 255, 0.15) with backdrop blur
   - Border radius: 8px
   - Padding: 1.5rem
   - Grid: 4 columns (responsive to 2 columns on mobile)
   - Each item: Label (Bold) = Value (smaller, lighter)

**Design Notes:**
- Use subtle backdrop blur for depth
- Ensure text has sufficient contrast (WCAG AA)
- Grid should collapse gracefully on mobile

---

### Product Flow Section

**Specs:**
- Background: #f8f9fa
- Padding: 2rem
- Border radius: 8px
- Margin bottom: 2rem

**Content:**
- Heading: "How It Works" - H2, centered
- Flow Steps: Horizontal layout (wrap on mobile)
  - Each step: Numbered circle (1-4), Title, Description
  - Arrows between steps: → (subtle gray)

**Flow Step Design:**
- Circle: 40px diameter, filled with #667eea, white number
- Title: H3 weight, Body size
- Description: Small text, Secondary color
- Spacing: 1.5rem gap between steps

---

### Wallet Connection Section

**Specs:**
- Background: White
- Padding: 1rem 1.5rem
- Border radius: 8px
- Flex layout: Space between items
- Border: 1px solid #e0e0e0 (optional)

**Content:**
- Left: Connection status (Connected: 0x1234...5678 or "Not connected")
- Right: Wallet button component

---

### Demo Flow Card (Main Interactive Area)

**Specs:**
- Background: White
- Padding: 2rem
- Border radius: 12px
- Box shadow: Elevated
- Max-width: 800px (centered)
- Margin: 2rem auto

**States:**

1. **Intro State:**
   - Title: "Demo: Mobile Library" - H2
   - Description: "Experience the complete flow in 3 simple steps"
   - Info box: Light gray background, rounded corners
     - List of pool configuration items
     - Use bullet points (colored dots, not emoji)
   - Step preview cards: 3 stacked cards with left border accent
   - CTA Button: Primary gradient, large, prominent

2. **Create Step:**
   - Title: "Step 1: Create a Library Pool"
   - Loading state: Button shows "Creating Pool..."
   - Success state: Button changes to "Pool Created - Proceed to Purchase"

3. **Purchase Step:**
   - Title: "Step 2: Buy a Library Pass"
   - Price display: Large, prominent number
   - Description: Duration and access details
   - CTA Button: Success color (green gradient)

4. **Result State:**
   - Title: "Settlement Result"
   - Settlement card: 
     - Background: Light green tint (#f0fdf4)
     - Border: 2px solid #10b981
     - Padding: 2rem
   - Breakdown:
     - Payment amount (large, bold)
     - Operator fee (subtle)
     - Revenue split section (with provider breakdowns)
   - Footer note: Italic, subtle text about deterministic split

---

### Why This Matters Section

**Specs:**
- Background: White
- Padding: 2rem
- Border radius: 12px
- Margin top: 3rem

**Layout:**
- Heading: "Why Pools Exist" - H3, centered
- Two-column grid (side by side comparison)
  - Without Pools: Red-tinted background, left border accent
  - With Pools: Green-tinted background, left border accent
- Each column: Title, bulleted list

---

## Component Specifications

### Buttons

**Primary Button:**
- Background: Primary gradient
- Text: White, Weight: 600
- Padding: 1rem 2rem
- Border radius: 8px
- Font size: 1.1rem
- Shadow: Button shadow
- Hover: Slightly darker gradient
- Disabled: 50% opacity, cursor: not-allowed

**Secondary Button:**
- Background: #666666
- Text: White
- Same sizing as primary
- Hover: #555555

**State Indicators:**
- Loading: Show spinner or "..." text
- Success: Change to success color
- Error: Change to error color

---

### Cards

**Default Card:**
- Background: White
- Padding: 1.5rem
- Border radius: 8px
- Box shadow: Card shadow
- Border: None (rely on shadow)

**Info Card:**
- Background: #e8f4f8 (Light blue tint)
- Border left: 4px solid #2196F3
- Padding: 1rem
- Border radius: 8px (except left side)

**Success Card:**
- Background: #f0fdf4 (Light green tint)
- Border: 2px solid #10b981
- Padding: 2rem
- Border radius: 8px

---

### Form Elements

**Input Fields:**
- Border: 1px solid #ddd
- Border radius: 4px
- Padding: 0.75rem
- Font size: 0.9rem
- Focus: 2px solid #667eea outline

**Labels:**
- Font weight: 500
- Font size: 0.9rem
- Margin bottom: 0.5rem
- Color: Primary text

**Helper Text:**
- Font size: 0.85rem
- Color: Secondary text
- Margin top: 0.25rem

---

## Responsive Breakpoints

```
Mobile: < 640px
- Single column layout
- Reduced padding (1rem instead of 2rem)
- Stacked flow steps

Tablet: 640px - 1024px
- 2-column grids become single column
- Flow steps wrap to 2 per row

Desktop: > 1024px
- Full multi-column layouts
- Horizontal flow steps
```

---

## Accessibility Guidelines

1. **Color Contrast:**
   - All text must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
   - Interactive elements must have visible focus states

2. **Interactive Elements:**
   - Minimum touch target: 44x44px
   - Buttons must have clear hover/active states
   - Disabled states must be visually distinct

3. **Typography:**
   - Line height minimum: 1.4
   - Paragraph spacing: 1rem minimum

---

## Figma Prompt (Copy & Paste)

```
Create a clean, professional web UI design for a blockchain protocol demo called "Pool Protocol".

DESIGN STYLE:
- Modern, minimal, enterprise-grade
- Clean typography with clear hierarchy
- Subtle shadows and borders for depth
- No emoji or decorative icons (use numbered steps instead)
- Professional color palette with purple-blue gradient accents

LAYOUT STRUCTURE:

1. HERO SECTION (Full width, centered, max 1200px):
   - Gradient background (purple-blue: #667eea to #764ba2)
   - White text
   - Title: "The Mobile Library" (2.5rem, bold)
   - Subtitle describing the concept
   - Semi-transparent card showing protocol mapping (Books=Services, Library=Pool, etc.)
   - Use grid layout for mapping items

2. PRODUCT FLOW SECTION:
   - Light gray background (#f8f9fa)
   - Heading: "How It Works"
   - 4 numbered steps horizontally (wrap on mobile):
     - Numbered circles (1-4) in purple
     - Step title and description
     - Arrows between steps

3. WALLET CONNECTION:
   - White card
   - Flex layout: status on left, button on right
   - Subtle border

4. DEMO FLOW CARD (Main interactive area):
   - White card, centered, max-width 800px
   - Shows different states:
     a) Intro: Pool configuration preview, 3 step cards, primary CTA
     b) Create: Step 1 with loading states
     c) Purchase: Step 2 with price display
     d) Result: Settlement breakdown card with revenue split

5. WHY THIS MATTERS:
   - Two-column comparison (Without/With Pools)
   - Red-tinted left column, green-tinted right column
   - Bulleted lists

DESIGN TOKENS:
- Colors: Primary gradient (#667eea to #764ba2), Backgrounds (#f5f5f5, white, #f8f9fa), Text (#1a1a1a, #666, #999), Success (#10b981), Error (#ef4444)
- Typography: Inter font family, H1 (2.5rem/700), H2 (1.75rem/600), Body (1rem/400), Small (0.85rem/400)
- Spacing: 8px base unit, use 0.25rem to 3rem scale
- Border radius: 4px (small), 8px (medium), 12px (large)
- Shadows: Card (0 1px 3px rgba(0,0,0,0.1)), Elevated (0 2px 8px rgba(0,0,0,0.1))

COMPONENTS:
- Buttons: Primary (gradient, white text, 1rem padding), Secondary (gray)
- Cards: White background, subtle shadow, 1.5rem padding, 8px radius
- Form inputs: 1px border, 4px radius, 0.75rem padding
- Info boxes: Colored left border (4px), tinted background

RESPONSIVE:
- Mobile: Single column, stacked layouts, reduced padding
- Tablet: 2-column where appropriate
- Desktop: Full multi-column layouts

ACCESSIBILITY:
- WCAG AA contrast ratios
- Clear focus states
- Minimum 44x44px touch targets
- Semantic HTML structure

Please create a comprehensive design system with these components and layouts, ensuring a professional, trustworthy appearance suitable for a technical demo.
```

---

## Design Checklist

- [ ] Hero section with gradient and protocol mapping
- [ ] Product flow with numbered steps (no emoji)
- [ ] Wallet connection component
- [ ] Demo flow card with 4 states (intro, create, purchase, result)
- [ ] Settlement result card with breakdown
- [ ] Why This Matters comparison section
- [ ] Responsive layouts for mobile/tablet/desktop
- [ ] Button variants (primary, secondary, states)
- [ ] Form elements (inputs, labels, helpers)
- [ ] Info/success/error card variants
- [ ] Typography scale implementation
- [ ] Color palette application
- [ ] Spacing system consistency
- [ ] Accessibility considerations

---

## Additional Design Tips

1. **Visual Hierarchy:**
   - Use size, weight, and color to guide attention
   - Most important actions should be largest and most prominent

2. **Whitespace:**
   - Don't be afraid of empty space
   - Use it to separate sections and improve readability

3. **Consistency:**
   - Use the same spacing, colors, and styles throughout
   - Create reusable component styles in Figma

4. **Mobile First:**
   - Design for mobile first, then expand
   - Test how layouts collapse on smaller screens

5. **States:**
   - Design all button states (default, hover, active, disabled, loading)
   - Design form validation states (error, success)

6. **Micro-interactions:**
   - Subtle hover effects on buttons
   - Smooth transitions between states
   - Loading indicators that match the design system

