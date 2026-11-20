# Strapispot

A Spotlight / Raycast-style command palette for the **Strapi 5** admin panel.

Press **Cmd/Ctrl + Shift + K** on any admin page, type, and jump to the entry you want, or to the screen where you create a new one. Everything works from the keyboard.

- **Search everything.** Plain text searches every collection you are allowed to read. Results are ranked, and the text that matched is highlighted.
- **Search inside one collection.** `in order alice` searches only Order. Tab completes collection names.
- **Create anywhere.** `new` lists the collections you may create entries in, with the relations each one points to (for example _Order → Customer, Product_), and opens the create screen.
- **Respects permissions.** Collections your role cannot read or create in are left out of search, or shown greyed out with a short reason.
- **Light and dark mode**, and it works in a narrow window.
- **Configurable.** Change the shortcut, choose which collections are searched, and pick which field is used as each entry's title.

Strapispot sends no data anywhere except to your own Strapi server. There is no telemetry.

## Requirements

- Strapi **5.x**. Developed and tested against **Strapi 5.63** (Node 24, PostgreSQL). Other 5.x versions are not tested yet; see [Stability](#stability).
- Node 18 or newer.

## Install

```bash
npm install strapi-plugin-strapispot
```

Then rebuild the admin panel:

```bash
npm run build   # or: npm run develop
```

A plugin installed from npm is picked up automatically. If you prefer to be explicit, add this to `config/plugins.ts`:

```ts
export default {
  strapispot: { enabled: true },
};
```

## Using the palette

Open it with **Cmd/Ctrl + Shift + K** (you can change this, see [Settings](#settings)).

| You type            | What happens                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `alice`             | Searches every collection you can read.                                                       |
| `in`                | Lists collections. Choose one to search inside it.                                            |
| `in order`          | Narrows the list to matching collections (`order`, `orders`, `blog-post`…). Tab completes it. |
| `in order alice`    | Searches only inside Order. With no text, shows the latest Order entries.                     |
| `new`               | Lists collections you may create entries in, with their relations.                            |
| `new ord`           | Narrows the list. Enter opens that collection's create screen.                                |
| `/in`, `/new`, `/i` | A leading `/` is optional. It means "I am typing a command", so only commands are shown.      |

When a command applies, its rows appear in a **Commands** section at the top, and the normal search **Results** appear below.

### Keys

| Key                | Action                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ |
| `↑` `↓`            | Move through the list (greyed-out rows are skipped).                                 |
| `Enter`            | Open the entry or create screen, or complete a suggestion.                           |
| `Cmd/Ctrl + Enter` | Open in a new browser tab.                                                           |
| `Tab`              | Complete the highlighted suggestion without opening anything.                        |
| `Backspace`        | After `in order `, one press leaves that collection and shows the suggestions again. |
| `Esc`              | Close.                                                                               |

## Permissions

- Search only queries collections your role can **read**. `in` shows other collections greyed out as "No read access".
- `new` shows collections you cannot **create** in greyed out as "No create access". A relation to a collection you cannot read is marked "no access".
- Strapi itself still enforces every permission. The greying-out is a convenience, not a security boundary. If the palette cannot load your permissions, it simply stops greying things out and Strapi refuses anything you are not allowed to do.
- Changing the settings needs the permission **Strapispot → Change settings**, which you can give to a role under _Settings → Administration panel → Roles_. Super Admins have it. Every logged-in admin can _read_ the settings, because the palette needs them.

## Settings

Open **Settings → Strapispot** in the admin panel.

- **Shortcut for everyone.** Click the box and press the keys. It must include Cmd/Ctrl or Alt.
- **Shortcut in this browser only.** Overrides the default for you alone, and takes effect at once. Useful when a browser keeps a key for itself: for example **Ctrl+Shift+K opens the developer console in Firefox**, and Cmd/Ctrl+K may clash with a rich-text editor's "insert link". Whether a browser lets a page take a given key can only be found out by trying it.
- **Searchable.** Untick a collection to leave it out of search and out of `in`. (`new` still lists it.)
- **Title field.** Choose which field is shown as the title of each entry. The default is the field Strapi's Content Manager already uses.

Project settings are stored in Strapi's plugin store, in your own database.

## Stability

Strapi does not document a way for a plugin to add a global shortcut, show something on every admin page, list content types with their relations, or read the current admin's permissions. Strapispot therefore relies on a few things that are **not part of Strapi's documented plugin API**:

- It mounts its own React root in the page (the palette), because there is no documented app-wide mount point.
- It reads Strapi's `isLoggedIn` flag in the browser's local storage to know when a session exists, so it does not call the server from the login page. If that flag changes, the palette still opens with the default shortcut but may not pick up the saved settings until the page is reloaded.
- It calls the admin routes that Strapi's own screens use:
  - `GET /content-manager/content-types`
  - `GET /content-manager/content-types/:uid/configuration`
  - `GET /content-manager/collection-types/:uid?_q=…`
  - `GET /admin/users/me/permissions`

These can change in a Strapi release. They are all kept in `admin/src/api/` so a fix would be small, and the unit tests cover the logic around them, but **a Strapi update may break Strapispot until it is updated**. Please open an issue if it does.

## Limitations

- Collection types only. Single types and the media library are not searched.
- Search uses Strapi's own search (`_q`), so it finds what the Content Manager would find: only fields Strapi treats as searchable. Strapispot ranks and highlights the results afterwards; it does not run its own full-text index.
- Up to 6 results per collection and 24 overall (20 when searching inside one collection). One request is sent per collection, at most 6 at a time, so a project with very many collections searches more slowly.
- `new` opens Strapi's create screen. It does not create entries inline.
- Not tested with the Internationalization plugin: entries open in the Content Manager's default locale.
- English only.

## Ideas, not built yet

Recent entries and pinned favourites; filters such as `in orders status:draft`; jumping to admin pages (settings, roles, API tokens, media); actions on the entry you are viewing (publish, unpublish, duplicate, copy document ID); "create related" with a relation pre-filled; a way for a host project to register its own commands.

## Development

```bash
git clone https://github.com/snntx/strapispot.git
cd strapispot
npm install

npm test               # unit tests (Node's built-in test runner, no extra framework)
npm run test:ts:front  # type-check the admin code
npm run test:ts:back   # type-check the server code
npm run build          # build to dist/
npm run verify         # check the package before publishing
```

To try your changes in a Strapi 5 project, use the Plugin SDK's link workflow (needs [`yalc`](https://github.com/wclr/yalc)):

```bash
npm run watch:link     # in this repo; prints the exact command to run next
```

See the Strapi docs: [Plugin SDK](https://docs.strapi.io/cms/plugins-development/plugin-sdk) and [Create a plugin](https://docs.strapi.io/cms/plugins-development/create-a-plugin).

Notes for a development Strapi app:

- Server-side changes need a restart of the Strapi app.
- Vite (the admin dev server) pre-bundles dependencies and does not watch `node_modules`. If your changes do not show up, add this to the app's `src/admin/vite.config.ts`:

  ```ts
  import { mergeConfig, type UserConfig } from 'vite';

  export default (config: UserConfig) =>
    mergeConfig(config, {
      optimizeDeps: { exclude: ['strapi-plugin-strapispot'] },
      server: { watch: { ignored: ['!**/node_modules/strapi-plugin-strapispot/**'] } },
    });
  ```

## Contributing

Issues and pull requests are welcome. Please run `npm test` and both type-checks first. Keep anything that depends on undocumented Strapi behaviour inside `admin/src/api/`, with a comment saying so.

## Licence

[MIT](./LICENSE)
