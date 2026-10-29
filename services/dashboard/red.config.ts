import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({cacheDir:path.resolve(__dirname,'.cache/red'),plugins:[react()],resolve:{alias:{'@':path.resolve(__dirname,'../../../team-reliability-v19/candidate/dashboard/src')}},test:{environment:'jsdom',setupFiles:['./src/__tests__/setup.ts'],globals:true}});
