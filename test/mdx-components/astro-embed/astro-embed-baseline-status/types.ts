export type StatusLevel = 'widely' | 'newly' | 'limited' | 'no_data';
export type SupportLevel = 'available' | 'unavailable' | 'no_data';
export type Browser = 'chrome' | 'edge' | 'firefox' | 'safari';

export interface BrowserImplementation {
	status: SupportLevel;
}

export interface Feature {
	name: string;
	feature_id?: string;
	browser_implementations?: Record<Browser, BrowserImplementation>;
	baseline: { status?: StatusLevel; low_date?: string };
}
