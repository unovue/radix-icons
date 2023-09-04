import { promises as fs } from 'node:fs'
import camelcase from 'camelcase'
import { promisify } from 'util'
import {rimraf} from 'rimraf'
import {transform as svgrTransform} from '@svgr/core'
import babel from '@babel/core'
import { compile as compileVue } from '@vue/compiler-dom'
import { dirname } from 'path'


let transform = {
  react: async (svg, componentName, format) => {
    let component = await svgrTransform(svg, { ref: true, titleProp: true }, { componentName })
    let { code } = await babel.transformAsync(component, {
      plugins: [['@babel/plugin-transform-react-jsx', { useBuiltIns: true }]],
    })

    if (format === 'esm') {
      return code
    }

    return code
      .replace('import * as React from "react"', 'const React = require("react")')
      .replace('export default', 'module.exports =')
  },
  vue: (svg, componentName, format) => {
    let { code } = compileVue(svg, {
      mode: 'module',
    })

    if (format === 'esm') {
      return code.replace('export function', 'export default function')
    }

    return code
      .replace(
        /import\s+\{\s*([^}]+)\s*\}\s+from\s+(['"])(.*?)\2/,
        (_match, imports, _quote, mod) => {
          let newImports = imports
            .split(',')
            .map((i) => i.trim().replace(/\s+as\s+/, ': '))
            .join(', ')

          return `const { ${newImports} } = require("${mod}")`
        }
      )
      .replace('export function render', 'module.exports = function render')
  },
}

async function getIcons() {
  let files = await fs.readdir('./icons')
  return Promise.all(
    files.map(async (file) => ({
      svg: await fs.readFile(`./icons/${file}`, 'utf8'),
      componentName: `${camelcase(file.replace(/\.svg$/, ''), {
        pascalCase: true,
      })}Icon`,
    }))
  )
}

function exportAll(icons, format, includeExtension = true) {
  return icons
    .map(({ componentName }) => {
      let extension = includeExtension ? '.js' : ''
      if (format === 'esm') {
        return `export { default as ${componentName} } from './${componentName}${extension}'`
      }
      return `module.exports.${componentName} = require("./${componentName}${extension}")`
    })
    .join('\n')
}

async function ensureWrite(file, text) {
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(file, text, 'utf8')
}

async function ensureWriteJson(file, json) {
  await ensureWrite(file, JSON.stringify(json, null, 2) + '\n')
}

async function buildIcons(pkg, format) {
  let outDir = `./${pkg}`
  if (format === 'esm') {
    outDir += '/esm'
  }

  let icons = await getIcons()

  await Promise.all(
    icons.flatMap(async ({ componentName, svg }) => {
      let content = await transform[pkg](svg, componentName, format)
      let types =
        pkg === 'react'
          ? `import * as React from 'react';\ndeclare const ${componentName}: React.ForwardRefExoticComponent<React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & { title?: string, titleId?: string } & React.RefAttributes<SVGSVGElement>>;\nexport default ${componentName};\n`
          : `import type { FunctionalComponent, HTMLAttributes, VNodeProps } from 'vue';\ndeclare const ${componentName}: FunctionalComponent<HTMLAttributes & VNodeProps>;\nexport default ${componentName};\n`

      return [
        ensureWrite(`${outDir}/${componentName}.js`, content),
        ...(types ? [ensureWrite(`${outDir}/${componentName}.d.ts`, types)] : []),
      ]
    })
  )

  await ensureWrite(`${outDir}/index.js`, exportAll(icons, format))

  await ensureWrite(`${outDir}/index.d.ts`, exportAll(icons, 'esm', false))
}

/**
 * @param {string[]} styles
 */
async function buildExports() {
  let pkg = {}

  // To appease Vite's optimizeDeps feature which requires a root-level import
  pkg[`.`] = {
    import: `./index.esm.js`,
    require: `./index.js`,
  }

  // For those that want to read the version from package.json
  pkg[`./package.json`] = { default: './package.json' }

    pkg[`.`] = {
      types: `./index.d.ts`,
      import: `./esm/index.js`,
      require: `./index.js`,
    }
    pkg[`./*`] = {
      types: `./*.d.ts`,
      import: `./esm/*.js`,
      require: `./*.js`,
    }
    pkg[`./*.js`] = {
      types: `./*.d.ts`,
      import: `./esm/*.js`,
      require: `./*.js`,
    }

    // This dir is basically an implementation detail, but it's needed for
    // backwards compatibility in case people were importing from it directly.
    pkg[`./esm/*`] = {
      types: `./*.d.ts`,
      import: `./esm/*.js`,
    }
    pkg[`./esm/*.js`] = {
      types: `./*.d.ts`,
      import: `./esm/*.js`,
    }


  return pkg
}

async function main(pkg) {
  const cjsPackageJson = { module: './esm/index.js', sideEffects: false }
  const esmPackageJson = { type: 'module', sideEffects: false }
  let packageJson = JSON.parse(await fs.readFile(`./${pkg}/package.json`, 'utf8'))

  console.log(`Building ${pkg} package...`)

  await Promise.all([
    rimraf(`./${pkg}/*`,{
      glob: {
        ignore: ['**/package.json', '**/README.md', '**/LICENSE', '**/CHANGELOG.md'],
      },
      preserveRoot: true,
    }),
  ])

  await Promise.all([
    buildIcons(pkg, 'cjs'),
    buildIcons(pkg, 'esm'),
    ensureWriteJson(`./${pkg}/esm/package.json`, esmPackageJson),
    ensureWriteJson(`./${pkg}/package.json`, cjsPackageJson),
  ])

  packageJson.exports = await buildExports([''])

  await ensureWriteJson(`./${pkg}/package.json`, packageJson)

  return console.log(`Finished building ${pkg} package.`)
}

let [pkg] = process.argv.slice(2)

if (!pkg) {
  throw new Error('Please specify a package')
}

main(pkg)
