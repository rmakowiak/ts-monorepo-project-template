const version = '${version}'
const packageName = process.env.npm_package_name
const scope = packageName.split('/')[1]

module.exports = {
  verbose: 2,
  plugins: {
    '@release-it/bumper': {
      out: [
        {
          file: 'helm/Chart.yaml',
          path: ['version'],
        },
        {
          file: 'helm/values.yaml',
          path: ['global.image.tag'],
        },
      ],
    },
    '@release-it/conventional-changelog': {
      path: '.',
      infile: 'CHANGELOG.md',
      preset: {
        name: 'conventionalcommits',
      },
      gitRawCommitsOpts: {
        path: '.',
      },
    },
  },
  git: {
    commitMessage: `chore(${scope}): released version v${version} [no ci]`,
    commitArgs: ['-n'],
    tagName: `${packageName}@${version}`,
  },
  npm: {
    publish: false,
    versionArgs: ['--workspaces false'],
  },
  github: {
    release: true,
    releaseName: `${packageName}@${version}`,
  },
}
