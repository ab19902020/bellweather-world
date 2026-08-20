import { getAdvancedWorld } from './_lib/world-store.mjs';

export default async () => {
  try {
    await getAdvancedWorld({ allowDeep: true, force: true });
    console.log('Bellweather heartbeat advanced the authoritative world.');
  } catch (error) {
    console.error('Bellweather heartbeat failed', error);
  }
};

export const config = {
  schedule: '* * * * *'
};
