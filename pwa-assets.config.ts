import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#15161C' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#15161C' } },
  },
  images: ['public/favicon.svg'],
})
