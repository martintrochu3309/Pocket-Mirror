import { cpSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

function copyRuntimeAssets() {
  let outDir

  return {
    name: 'copy-runtime-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      for (const directory of ['images', 'media']) {
        cpSync(resolve(process.cwd(), directory), resolve(outDir, directory), {
          recursive: true
        })
      }
    }
  }
}

export default defineConfig({
  plugins: [copyRuntimeAssets()]
})
