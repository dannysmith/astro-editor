# Task: Code Review Tasks

Series of Extensive Code Reviews with specific AI Agent personalities, with clear focussed review goals: "Look for opportunities to..." Maybe do this with GEMINI?

## 1 - Shadcn components ✅

Review shadcn components for any which are unnececarry. We may wish to keep a few which are currently unused but we think will be used soon.

## 2 - Naming ✅

Review all naming (components, methods, variables, functions, files etc) for better readability and consistency of naming convention accross the codebase.

## 3 - Overly clever TS code ✅

- Refactor any overly "clever" TS code so it's easier to understand
- Remove all unnececary `console.log` and code comments.

## 4 - CSS/tailwind ✅

Remove all redundant or unnececarry tailwind classes. Look for areas where we are using css But could be using Tailwind. Review this systematically and carefully as though you are a highly experienced Tailwind and React engineer. The goal here is simply to simplify the codebase if at all possible. No changes to the design or functionality are acceptable. So if in doubt, leave things as they are.

## 6 - Security Review ✅

You are an expert security consultant With many years' experience reviewing Mac OS an react apps. You are expert at reviewing Tauri/React apps. Review the entire codebase in detail and identify any security problems. Separately identify any potential security problems. If you find nothing, that's okay.Write your output to docs/SECURITY_REVIEW.md
