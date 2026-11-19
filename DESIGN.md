# WebView generated prospect preview design

## 1. Product and Users

A small business owner should be able to recognize their business in a finished preview and try the customer journey. Visitors need to understand available services and contact the business.

## 2. User Flow and Journey

| Stage | User Goal | Entry Point | Pages or Screens | Exit and Next Stage |
|---|---|---|---|---|
| Discover | Identify service and locality | Preview link | Home | See services or contact |
| Evaluate | Check fit and understand what to ask | Main navigation | Services, About | Open Contact |
| Contact | Call or get directions | Page action or navigation | Contact | Open phone dialer or map |

## 3. Page and Screen Inventory

| ID | Page or Screen | Route or File | Journey Stage | Primary Action | Status |
|---|---|---|---|---|---|
| home | Home | / | Discover | Call or browse services | Ready |
| services | Services | /services/ | Evaluate | Compare services | Ready |
| about | About | /about/ | Evaluate | Learn about the business | Ready |
| contact | Contact | /contact/ | Contact | Call or open directions | Ready |

## Art Direction

- Character: Material, confident, and local. Show useful details and realistic illustrative imagery.
- Tokens: Use Astra type and surface defaults with scoped preview CSS and optional validated brand accents.
- Build mandate: Source section order and business evidence determine the page. Keep demo placeholders out.
- Composition patterns: Split photo hero, high-contrast utility strip, card grid, service guidance, FAQ, and contact band.
- Component and usage rules: Use a single clear primary action per section. Keep support links native.

## 4. Global Design Principles

Use the canonical `DESIGN-GUIDE.md` for design and interaction rules.

| Principle | Global application |
|---|---|
| Fitts's Law | Large separated tap targets. |
| Visual Hierarchy | Use an H1 and a clear next action before supporting details. |
| Von Restorff Effect | Give the primary action a distinct fill. |
| Object Constancy | Keep business identity and contact navigation stable. |
| Snapping | N/A. This page uses normal document flow. |
| Motion Blur | N/A. This page uses static transitions. |
| Natural Mapping | Keep each action next to the related information. |
| Tabular Figures | Use readable numerals for phone and any times. |
| Animate Only the Delta | N/A. The content is static. |
| Inertia | Use browser-native scrolling. |
| Multimodal Feedback | Keep action text legible and the target visible on focus. |
| Visual Cues | Show hover, focus, and active navigation distinctly. |
| Skeuomorphism | N/A. Links use plain text and standard navigation. |

## 5. Page-by-Page Contracts

### Page: Home

#### Purpose and Journey
Show the business, locality and first contact action, then practical details, a service grid, visit guidance and a closing action.

#### Layout and Hierarchy
Follow the source template’s Home section order. Lead with the page heading and use a concise supporting intro.

#### Components and States
Use scoped source-section layouts, clear service or practical details, and a static contact action. Halt if required copy is absent.

#### Accessibility
Maintain semantic headings, visible keyboard focus, descriptive links and labeled photography.

#### Responsive Behavior
Keep links comfortably tappable and stack columns at mobile widths. Prevent horizontal overflow.

#### Motion and Feedback
Use native navigation with clear hover and focus feedback.

#### Content and Forms
Call or browse services. Use verified facts and labels from the brief. Phone and directions work as links in the static export.

#### Principle Adherence

| Principle | Application | Verification |
|---|---|---|
| Fitts's Law | Large separated tap targets. | Review / in Chromium. |
| Visual Hierarchy | Use an H1 and a clear next action before supporting details. | Review / in Chromium. |
| Von Restorff Effect | Give the primary action a distinct fill. | Review / in Chromium. |
| Object Constancy | Keep business identity and contact navigation stable. | Review / in Chromium. |
| Snapping | N/A. This page uses normal document flow. | Review / in Chromium. |
| Motion Blur | N/A. This page uses static transitions. | Review / in Chromium. |
| Natural Mapping | Keep each action next to the related information. | Review / in Chromium. |
| Tabular Figures | Use readable numerals for phone and any times. | Review / in Chromium. |
| Animate Only the Delta | N/A. The content is static. | Review / in Chromium. |
| Inertia | Use browser-native scrolling. | Review / in Chromium. |
| Multimodal Feedback | Keep action text legible and the target visible on focus. | Review / in Chromium. |
| Visual Cues | Show hover, focus, and active navigation distinctly. | Review / in Chromium. |
| Skeuomorphism | N/A. Links use plain text and standard navigation. | Review / in Chromium. |

#### Verification
Check / at desktop and mobile widths, including the primary action and contrast.

### Page: Services

#### Purpose and Journey
Explain each confirmed service, what to mention when calling, and how to request a quote.

#### Layout and Hierarchy
Follow the source template’s Services section order. Lead with the page heading and use a concise supporting intro.

#### Components and States
Use scoped source-section layouts, clear service or practical details, and a static contact action. Halt if required copy is absent.

#### Accessibility
Maintain semantic headings, visible keyboard focus, descriptive links and labeled photography.

#### Responsive Behavior
Keep links comfortably tappable and stack columns at mobile widths. Prevent horizontal overflow.

#### Motion and Feedback
Use native navigation with clear hover and focus feedback.

#### Content and Forms
Compare services. Use verified facts and labels from the brief. Phone and directions work as links in the static export.

#### Principle Adherence

| Principle | Application | Verification |
|---|---|---|
| Fitts's Law | Large separated tap targets. | Review /services/ in Chromium. |
| Visual Hierarchy | Use an H1 and a clear next action before supporting details. | Review /services/ in Chromium. |
| Von Restorff Effect | Give the primary action a distinct fill. | Review /services/ in Chromium. |
| Object Constancy | Keep business identity and contact navigation stable. | Review /services/ in Chromium. |
| Snapping | N/A. This page uses normal document flow. | Review /services/ in Chromium. |
| Motion Blur | N/A. This page uses static transitions. | Review /services/ in Chromium. |
| Natural Mapping | Keep each action next to the related information. | Review /services/ in Chromium. |
| Tabular Figures | Use readable numerals for phone and any times. | Review /services/ in Chromium. |
| Animate Only the Delta | N/A. The content is static. | Review /services/ in Chromium. |
| Inertia | Use browser-native scrolling. | Review /services/ in Chromium. |
| Multimodal Feedback | Keep action text legible and the target visible on focus. | Review /services/ in Chromium. |
| Visual Cues | Show hover, focus, and active navigation distinctly. | Review /services/ in Chromium. |
| Skeuomorphism | N/A. Links use plain text and standard navigation. | Review /services/ in Chromium. |

#### Verification
Check /services/ at desktop and mobile widths, including the primary action and contrast.

### Page: About

#### Purpose and Journey
Explain the business model and local context, and show how to choose between a visit and an on-location request.

#### Layout and Hierarchy
Follow the source template’s About section order. Lead with the page heading and use a concise supporting intro.

#### Components and States
Use scoped source-section layouts, clear service or practical details, and a static contact action. Halt if required copy is absent.

#### Accessibility
Maintain semantic headings, visible keyboard focus, descriptive links and labeled photography.

#### Responsive Behavior
Keep links comfortably tappable and stack columns at mobile widths. Prevent horizontal overflow.

#### Motion and Feedback
Use native navigation with clear hover and focus feedback.

#### Content and Forms
Learn about the business. Use verified facts and labels from the brief. Phone and directions work as links in the static export.

#### Principle Adherence

| Principle | Application | Verification |
|---|---|---|
| Fitts's Law | Large separated tap targets. | Review /about/ in Chromium. |
| Visual Hierarchy | Use an H1 and a clear next action before supporting details. | Review /about/ in Chromium. |
| Von Restorff Effect | Give the primary action a distinct fill. | Review /about/ in Chromium. |
| Object Constancy | Keep business identity and contact navigation stable. | Review /about/ in Chromium. |
| Snapping | N/A. This page uses normal document flow. | Review /about/ in Chromium. |
| Motion Blur | N/A. This page uses static transitions. | Review /about/ in Chromium. |
| Natural Mapping | Keep each action next to the related information. | Review /about/ in Chromium. |
| Tabular Figures | Use readable numerals for phone and any times. | Review /about/ in Chromium. |
| Animate Only the Delta | N/A. The content is static. | Review /about/ in Chromium. |
| Inertia | Use browser-native scrolling. | Review /about/ in Chromium. |
| Multimodal Feedback | Keep action text legible and the target visible on focus. | Review /about/ in Chromium. |
| Visual Cues | Show hover, focus, and active navigation distinctly. | Review /about/ in Chromium. |
| Skeuomorphism | N/A. Links use plain text and standard navigation. | Review /about/ in Chromium. |

#### Verification
Check /about/ at desktop and mobile widths, including the primary action and contrast.

### Page: Contact

#### Purpose and Journey
Provide the phone, address and directions, with a short checklist for the call.

#### Layout and Hierarchy
Follow the source template’s Contact section order. Lead with the page heading and use a concise supporting intro.

#### Components and States
Use scoped source-section layouts, clear service or practical details, and a static contact action. Halt if required copy is absent.

#### Accessibility
Maintain semantic headings, visible keyboard focus, descriptive links and labeled photography.

#### Responsive Behavior
Keep links comfortably tappable and stack columns at mobile widths. Prevent horizontal overflow.

#### Motion and Feedback
Use native navigation with clear hover and focus feedback.

#### Content and Forms
Call or open directions. Use verified facts and labels from the brief. Phone and directions work as links in the static export.

#### Principle Adherence

| Principle | Application | Verification |
|---|---|---|
| Fitts's Law | Large separated tap targets. | Review /contact/ in Chromium. |
| Visual Hierarchy | Use an H1 and a clear next action before supporting details. | Review /contact/ in Chromium. |
| Von Restorff Effect | Give the primary action a distinct fill. | Review /contact/ in Chromium. |
| Object Constancy | Keep business identity and contact navigation stable. | Review /contact/ in Chromium. |
| Snapping | N/A. This page uses normal document flow. | Review /contact/ in Chromium. |
| Motion Blur | N/A. This page uses static transitions. | Review /contact/ in Chromium. |
| Natural Mapping | Keep each action next to the related information. | Review /contact/ in Chromium. |
| Tabular Figures | Use readable numerals for phone and any times. | Review /contact/ in Chromium. |
| Animate Only the Delta | N/A. The content is static. | Review /contact/ in Chromium. |
| Inertia | Use browser-native scrolling. | Review /contact/ in Chromium. |
| Multimodal Feedback | Keep action text legible and the target visible on focus. | Review /contact/ in Chromium. |
| Visual Cues | Show hover, focus, and active navigation distinctly. | Review /contact/ in Chromium. |
| Skeuomorphism | N/A. Links use plain text and standard navigation. | Review /contact/ in Chromium. |

#### Verification
Check /contact/ at desktop and mobile widths, including the primary action and contrast.

## 6. Cross-Page Consistency

Use the same header, menu, footer identity and contact methods on every page. Preserve normal navigation in both WordPress staging and the static ZIP.

## 7. Verification, Evidence, and Open Questions

The 2026-11-19 automotive pilot used the verified Car Repair WXR. Chromium rendered all four pages at 1440px and 390px. The ZIP passed route, image, font and style loading checks, native mobile navigation, keyboard FAQ interaction, and phone and directions link checks. Evidence is in the OneDrive Companion catalog runbook and the local `Downloads/WebView-TheCarMan-Pilot` folder. Additional layout maps need their own verification.
