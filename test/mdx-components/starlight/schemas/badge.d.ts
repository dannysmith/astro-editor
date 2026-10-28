import { z } from "astro/zod";
//#region src/schemas/badge.d.ts
declare const badgeSchema: z.ZodObject<{
  text: z.ZodString;
  variant: z.ZodDefault<z.ZodEnum<{
    default: "default";
    success: "success";
    note: "note";
    danger: "danger";
    caution: "caution";
    tip: "tip";
  }>>;
  class: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const i18nBadgeSchema: z.ZodObject<{
  text: z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>;
  variant: z.ZodDefault<z.ZodEnum<{
    default: "default";
    success: "success";
    note: "note";
    danger: "danger";
    caution: "caution";
    tip: "tip";
  }>>;
  class: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const BadgeComponentSchema: z.ZodObject<{
  size: z.ZodDefault<z.ZodEnum<{
    small: "small";
    medium: "medium";
    large: "large";
  }>>;
  text: z.ZodString;
  variant: z.ZodDefault<z.ZodEnum<{
    default: "default";
    success: "success";
    note: "note";
    danger: "danger";
    caution: "caution";
    tip: "tip";
  }>>;
  class: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
type BadgeComponentProps = z.input<typeof BadgeComponentSchema>;
declare const BadgeConfigSchema: () => z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
  text: z.ZodString;
  variant: z.ZodDefault<z.ZodEnum<{
    default: "default";
    success: "success";
    note: "note";
    danger: "danger";
    caution: "caution";
    tip: "tip";
  }>>;
  class: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>, z.ZodTransform<{
  text: string;
  variant: "default" | "success" | "note" | "danger" | "caution" | "tip";
  class?: string | undefined;
}, string | {
  text: string;
  variant: "default" | "success" | "note" | "danger" | "caution" | "tip";
  class?: string | undefined;
}>>>;
type I18nBadgeUserConfig = string | {
  variant?: 'note' | 'danger' | 'success' | 'caution' | 'tip' | 'default' | undefined;
  class?: string | undefined;
  text: string | Record<string, string>;
} | undefined;
declare const I18nBadgeConfigSchema: () => z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
  text: z.ZodUnion<readonly [z.ZodString, z.ZodRecord<z.ZodString, z.ZodString>]>;
  variant: z.ZodDefault<z.ZodEnum<{
    default: "default";
    success: "success";
    note: "note";
    danger: "danger";
    caution: "caution";
    tip: "tip";
  }>>;
  class: z.ZodOptional<z.ZodString>;
}, z.core.$strip>]>>;
type Badge = z.output<typeof badgeSchema>;
type I18nBadge = z.output<typeof i18nBadgeSchema>;
type I18nBadgeConfig = z.output<ReturnType<typeof I18nBadgeConfigSchema>>;
//#endregion
export { Badge, BadgeComponentProps, BadgeComponentSchema, BadgeConfigSchema, I18nBadge, I18nBadgeConfig, I18nBadgeConfigSchema, I18nBadgeUserConfig };