import { StarlightIcon } from "../components-internals/Icons.js";
//#region src/integrations/aside-utils.d.ts
declare const asideVariants: readonly ["note", "tip", "caution", "danger"];
type AsideVariant = (typeof asideVariants)[number];
declare function isAsideVariant(value: string): value is AsideVariant;
declare function getAsideIconName(variant: AsideVariant, customIcon?: string | null): StarlightIcon;
declare function getAsideIcon(variant: AsideVariant, customIcon?: string | null): string;
//#endregion
export { AsideVariant, asideVariants, getAsideIcon, getAsideIconName, isAsideVariant };