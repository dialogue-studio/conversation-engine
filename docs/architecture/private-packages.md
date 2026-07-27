# Private package distribution

`@dialogue-studio/scenario-schema` and
`@dialogue-studio/core-engine` are internal npm packages hosted in GitHub
Packages. They are not public npm packages and must not inherit access from the
public `conversation-engine` repository.

## Publishing

Publishing is intentionally manual. An organization owner runs the **Publish
internal packages** workflow only after a reviewed version change. It builds
the packages and publishes the schema before the engine, because the engine
depends on it.

The workflow uses its short-lived `GITHUB_TOKEN`; no registry token is stored
in this repository.

## Consuming from an adapter

An adapter repository needs this `.npmrc` configuration:

```text
@dialogue-studio:registry=https://npm.pkg.github.com
```

Its local development token belongs in the developer's user-level `~/.npmrc`
and needs `read:packages`. An adapter's GitHub Actions workflow uses its
short-lived `GITHUB_TOKEN` with `packages: read`; it must not commit a package
token into the repository.

After the first publication, an organization owner grants
`conversation-vk` read access in each package's **Manage Actions access**
settings. Packages keep granular private access rather than inheriting the
visibility of `conversation-engine`.
