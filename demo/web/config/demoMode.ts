export type DemoMode = 'local' | 'mock';

export const DEMO_MODE = (process.env.NEXT_PUBLIC_DEMO_MODE || 'local') as DemoMode;
export const isMockMode = DEMO_MODE === 'mock';
export const isLocalMode = DEMO_MODE === 'local';
