---
name: Yamazumi Frontend Standards
description: Guidelines for building the UI using React, Tailwind CSS, and shadcn/ui.
---

# Yamazumi Frontend Standards

This skill guides the development of the frontend to ensure a premium, consistent, and performant user interface.

## 1. UI Components (shadcn/ui)
- **Source of Truth**: Always use `shadcn/ui` components for core UI elements (Buttons, Dialogs, Cards, etc.).
- **Installation**: If a component is missing, use the command `npx shadcn-ui@latest add [component-name]`.
- **Customization**: Don't edit files in `src/components/ui/` unless absolutely necessary. Instead, wrap them or use composition.
- **Styling**: Use Tailwind CSS for all styling. Follow the project's color palette defined in `tailwind.config.js`.

## 2. Design Principles (Premium Look)
- **Glassmorphism**: Use subtle background blurs (`backdrop-blur-md`) and semi-transparent backgrounds for overlays and headers.
- **Animations**: Use `framer-motion` for smooth transitions between states and pages.
- **Typography**: Stick to the primary font (e.g., Inter/Outfit) and maintain consistent hierarchy.

## 3. State Management & Data Fetching
- **React Query**: Use `@tanstack/react-query` for all server state.
- **Zustand**: Use `zustand` for simple global client state (e.g., UI theme, sidebar toggle).
- **Loading States**: Always implement skeleton loaders during data fetching to improve perceived performance.

## 4. Component Structure
- Place reusable UI components in `src/components/ui/`.
- Place feature-specific components in `src/components/features/[feature-name]/`.
- Use functional components and hooks.
