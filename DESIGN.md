# WebView generated prospect preview design

## 1. Product and Users

A small business owner should be able to recognize their business in a finished preview and try the customer journey. Visitors need to understand available services and contact the business.

## 2. User Flow and Journey

| Stage | User Goal | Entry Point | Pages or Screens | Exit and Next Stage |
|---|---|---|---|---|
| Discover | Identify service and locality | Preview link | Home | See services or contact |
| Evaluate | Check fit and understand what to ask | Main navigation | Services, Service detail, About | Open the relevant service or Contact |
| Contact | Call or get directions | Page action or navigation | Contact | Open phone dialer or map |

## 3. Page and Screen Inventory

| ID | Page or Screen | Route or File | Journey Stage | Primary Action | Status |
|---|---|---|---|---|---|
| home | Home | / | Discover | Call or browse services | Ready |
| services | Services | /services/ | Evaluate | Compare services | Ready |
| service-detail | Service detail | /services/<service>/ | Evaluate | Read scope or call | Ready |
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

### Page: Service detail

#### Purpose and Journey
Help a customer evaluate one confirmed offering and decide what to ask when calling.

#### Layout and Hierarchy
Lead with the service and optional approved hero photo. Follow with scope, when to book, what to expect, service-specific questions, related service links, and a closing call action. Record the demo page and component positions in the reviewed layout.

#### Components and States
Render one page per confirmed service. Use the same detail shape for copy-only and approved-photo pages.

#### Accessibility
Expose the service links and menu children to keyboard users. Use explicit photo alt text and adjacent credit.

#### Responsive Behavior
Keep a single column on narrow screens and readable line lengths on desktop.

#### Motion and Feedback
Retain Astra's standard accessible menu behavior and visible link focus.

#### Content and Forms
Make one researched service the subject of each page. Use the real public phone link and no form dependency.

#### Principle Adherence

| Principle | Application | Verification |
|---|---|---|
| Fitts's Law | Keep the call target large. | Measure at mobile width. |
| Visual Hierarchy | Lead with the service title and action. | Review the top of each page. |
| Von Restorff Effect | Reserve accent fill for calling. | Inspect in Chromium. |
| Object Constancy | Reuse the menu, brand identity and contact format. | Navigate from Services. |
| Snapping | N/A. This page follows document flow. | Check for horizontal overflow. |
| Motion Blur | N/A. The page uses static transitions. | Check reduced motion. |
| Natural Mapping | Put the details under their service title. | Read the route and heading. |
| Tabular Figures | Keep the phone digits readable. | Inspect the call label. |
| Animate Only the Delta | N/A. Content is static. | Check reduced motion. |
| Inertia | Use browser-native scrolling. | Scroll on mobile. |
| Multimodal Feedback | Use clear link text and focus indication. | Keyboard test. |
| Visual Cues | Style hover and keyboard focus. | Check CTA focus. |
| Skeuomorphism | N/A. The page uses standard text links. | Review controls. |

#### Verification
Open each service from the index and navigation. Check the specific text, photo attribution where present, and the callback target.

## 6. Cross-Page Consistency

Use the same header, menu, footer identity and contact methods on every page. The visit area at the foot of each page keeps the physical address, directions and approved map together. A labeled, lazy-loaded map leaves the directions link usable when the embed is unavailable. On About or Contact, group confirmed hours and access, facilities, booking and payment details for scanning. Keep source links to listing photos, videos and reviews together and label approved media. Preserve normal navigation in both WordPress staging and the static ZIP.

## 7. Verification, Evidence, and Open Questions

The Elementor automotive pilot used the verified Car Repair 02 WXR. Chromium rendered all eight exported pages at 1440px and 390px with no missing local assets. It followed the service menus, operated the questions by keyboard, checked the visiting information, footer map, contact links, and ZIP sitemap. The business’s YouTube player loaded on staging. Evidence is in `Downloads/WebView-TheCarMan-Elementor`. The live Places UI Kit panel still needs configured-provider verification. Additional layout maps need their own verification.
