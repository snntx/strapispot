import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Typography, Flex, VisuallyHidden } from '@strapi/design-system';
import { Search } from '@strapi/icons';

import { loadCollections, type CollectionInfo } from '../api/collections';
import { loadPermissions, type PermissionSet } from '../api/permissions';
import {
  DEFAULT_SETTINGS,
  SETTINGS_EVENT,
  clearSettingsCache,
  getLocalShortcut,
  loadSettings,
  type Settings,
} from '../api/settings';
import { searchCollections, type SearchOutcome, type SearchResult } from '../api/search';
import { createPath, entryPath, goTo } from '../utils/adminPaths';
import {
  canonicalAlias,
  parseInput,
  resolveCollection,
  suggestCollections,
  type Command,
} from '../utils/command';
import { describeRelations, formatRelations } from '../utils/relations';
import {
  DEFAULT_SHORTCUT,
  formatShortcut,
  isMac,
  matchesShortcut,
  parseShortcut,
} from '../utils/shortcut';
import { Highlight } from './Highlight';
import {
  Content,
  Ellipsis,
  Footer,
  Heading,
  Input,
  InputRow,
  Kbd,
  List,
  Message,
  Row,
  Scope,
  Tag,
  Text,
} from './styles';

const DEBOUNCE_MS = 200;
const EMPTY: SearchOutcome = { results: [], skipped: [] };

type Phase = 'idle' | 'loading' | 'done' | 'error';

/** One line in the list: an entry, a collection to complete to, or a command. */
type Item =
  | { type: 'result'; key: string; result: SearchResult }
  | {
      type: 'collection';
      key: string;
      /** "in": pick a collection to search in. "new": pick a collection to create in. */
      mode: 'in' | 'new';
      collection: CollectionInfo;
      alias: string;
      /** Why this row cannot be used (shown greyed out), or null when it can. */
      disabled: string | null;
      /** Second line of the row. */
      detail: string;
    }
  | { type: 'command'; key: string; command: Command; fill: string };

const isDisabled = (item: Item) => item.type === 'collection' && item.disabled !== null;

const Palette = ({ onOpen }: { onOpen?: () => void }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [localShortcut, setLocalShortcutState] = useState<string | null>(() => getLocalShortcut());
  /** A shortcut chosen for this browser wins over the project default. */
  const shortcut = useMemo(
    () =>
      (localShortcut ? parseShortcut(localShortcut) : null) ??
      parseShortcut(settings.shortcut) ??
      parseShortcut(DEFAULT_SHORTCUT)!,
    [localShortcut, settings.shortcut]
  );
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [collections, setCollections] = useState<CollectionInfo[] | null>(null);
  const [collectionsFailed, setCollectionsFailed] = useState(false);
  /** null = unknown (could not be loaded): then nothing is greyed out and the server decides. */
  const [perms, setPerms] = useState<PermissionSet | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [outcome, setOutcome] = useState<SearchOutcome>(EMPTY);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Every collection, with the title field chosen in the settings applied. */
  const allCollections = useMemo(
    () =>
      collections
        ? collections.map((c) =>
            settings.titleFields[c.uid] && c.titleFields.includes(settings.titleFields[c.uid])
              ? { ...c, mainField: settings.titleFields[c.uid] }
              : c
          )
        : null,
    [collections, settings.titleFields]
  );
  /** The collections left in search and in "in …" (the settings can exclude some). */
  const searchable = useMemo(
    () =>
      allCollections ? allCollections.filter((c) => !settings.excluded.includes(c.uid)) : null,
    [allCollections, settings.excluded]
  );

  // --- what did the user type? ----------------------------------------------
  const parsed = useMemo(() => parseInput(raw), [raw]);
  const inArgs = parsed.inArgs;
  /** Keep the user's own style when completing: with or without a leading "/". */
  const prefix = parsed.slash ? '/' : '';

  const scope = useMemo(
    () =>
      inArgs && inArgs.tokenDone && searchable
        ? resolveCollection(inArgs.token, searchable)
        : undefined,
    [inArgs, searchable]
  );

  /** Text to search for: inside one collection, or across all of them. */
  const searchText = scope ? (inArgs?.text ?? '') : parsed.plain;
  const searchScopeUid = scope?.uid ?? null;
  const scopeBlocked = scope !== undefined && perms !== null && !perms.canRead(scope.uid);
  const wantsSearch = !scopeBlocked && (scope !== undefined || parsed.plain !== '');

  // --- open / close ---------------------------------------------------------
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // Load the project settings. The palette is created before anyone logs in, so we wait
  // (a cheap local check, no network) until Strapi says there is a session, then fetch once.
  useEffect(() => {
    let stopped = false;
    let loaded = false;
    let failures = 0;
    const attempt = async () => {
      if (stopped || loaded) return;
      let loggedIn = false;
      try {
        loggedIn = window.localStorage.getItem('isLoggedIn') === 'true';
      } catch {
        // storage blocked: try anyway
        loggedIn = true;
      }
      if (!loggedIn) return;
      try {
        setSettings(await loadSettings());
        loaded = true;
      } catch {
        if (++failures >= 3) stopped = true; // settings route missing or broken: use the defaults
      }
    };
    const reload = () => {
      clearSettingsCache();
      setLocalShortcutState(getLocalShortcut());
      loaded = false;
      failures = 0;
      stopped = false;
      void attempt();
    };
    void attempt();
    const timer = window.setInterval(attempt, 2000);
    window.addEventListener(SETTINGS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener(SETTINGS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesShortcut(event, shortcut)) return;
      // Stop the browser (and Strapi's own handlers) from acting on this key.
      event.preventDefault();
      event.stopPropagation();
      setOpen((prev) => !prev);
    };
    // Capture phase: we see the key before the page's own listeners do.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [shortcut]);

  useEffect(() => {
    if (!open) {
      setRaw('');
      setPhase('idle');
      setOutcome(EMPTY);
      setActive(0);
      return;
    }
    onOpenRef.current?.();
    // Fetch the collection list as soon as the palette opens (it is cached for a minute).
    const controller = new AbortController();
    setCollectionsFailed(false);
    loadCollections(controller.signal)
      .then(setCollections)
      .catch(() => {
        if (!controller.signal.aborted) setCollectionsFailed(true);
      });
    loadSettings(controller.signal)
      .then(setSettings)
      .catch(() => {
        // keep what we have
      });
    loadPermissions(controller.signal)
      .then(setPerms)
      .catch(() => {
        if (!controller.signal.aborted) setPerms(null);
      });
    return () => controller.abort();
  }, [open]);

  // --- search ---------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    if (!wantsSearch || !searchable) {
      setPhase('idle');
      setOutcome(EMPTY);
      return;
    }

    const targets = (
      searchScopeUid ? searchable!.filter((c) => c.uid === searchScopeUid) : searchable!
    ).filter((c) => !perms || perms.canRead(c.uid));
    const controller = new AbortController();
    setPhase('loading');
    const timer = window.setTimeout(
      async () => {
        try {
          const result = await searchCollections(targets, searchText ?? '', controller.signal);
          if (controller.signal.aborted) return;
          setOutcome(result);
          setPhase('done');
        } catch {
          if (!controller.signal.aborted) setPhase('error');
        }
      },
      searchText ? DEBOUNCE_MS : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, wantsSearch, searchText, searchScopeUid, searchable, perms]);

  // --- the list shown under the input ----------------------------------------
  // Commands come first, ordinary search results below them.
  const commandItems: Item[] = useMemo(() => {
    if (scope) return [];
    const invoked = parsed.invoked?.id;
    if ((invoked === 'in' && inArgs && searchable) || (invoked === 'new' && allCollections)) {
      const mode = invoked === 'in' ? 'in' : 'new';
      const token = mode === 'in' ? (inArgs?.token ?? '') : (parsed.newToken ?? '');
      const pool = (mode === 'in' ? searchable : allCollections)!;
      const rows = suggestCollections(token, pool).map((collection): Item => {
        const allowed =
          !perms ||
          (mode === 'in' ? perms.canRead(collection.uid) : perms.canCreate(collection.uid));
        const alias = canonicalAlias(collection);
        return {
          type: 'collection',
          key: `${mode}:${collection.uid}`,
          mode,
          collection,
          alias,
          disabled: allowed ? null : mode === 'in' ? 'No read access' : 'No create access',
          detail:
            mode === 'in'
              ? `in ${alias}`
              : formatRelations(
                  describeRelations(collection, allCollections!, perms ? perms.canRead : undefined)
                ),
        };
      });
      // Usable rows first, greyed-out ones after them (each group keeps its order).
      return [...rows.filter((r) => !isDisabled(r)), ...rows.filter(isDisabled)];
    }
    return parsed.suggested.map((command) => ({
      type: 'command' as const,
      key: `cmd:${command.id}`,
      command,
      fill: `/${command.keyword} `,
    }));
  }, [parsed, inArgs, scope, searchable, allCollections, perms]);

  const resultItems: Item[] = useMemo(
    () =>
      wantsSearch
        ? outcome.results.map((result) => ({ type: 'result' as const, key: result.key, result }))
        : [],
    [wantsSearch, outcome]
  );

  const items: Item[] = useMemo(
    () => [...commandItems, ...resultItems],
    [commandItems, resultItems]
  );

  useEffect(
    () =>
      setActive(
        Math.max(
          0,
          items.findIndex((i) => !isDisabled(i))
        )
      ),
    [items]
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, items]);

  // --- actions --------------------------------------------------------------
  const complete = useCallback((text: string) => {
    setRaw(text);
    inputRef.current?.focus();
  }, []);

  const openResult = useCallback((result: SearchResult, newTab: boolean) => {
    const path = entryPath(result.uid, result.documentId);
    if (newTab) {
      window.open(path, '_blank', 'noopener');
      return;
    }
    setOpen(false);
    goTo(path);
  }, []);

  const openPath = useCallback((path: string, newTab: boolean) => {
    if (newTab) {
      window.open(path, '_blank', 'noopener');
      return;
    }
    setOpen(false);
    goTo(path);
  }, []);

  /** Enter / click: open an entry, open a create screen, or fill in the input. Greyed-out rows do nothing. */
  const choose = useCallback(
    (item: Item, newTab: boolean) => {
      if (isDisabled(item)) return;
      if (item.type === 'result') openResult(item.result, newTab);
      else if (item.type === 'collection' && item.mode === 'new')
        openPath(createPath(item.collection.uid), newTab);
      else if (item.type === 'collection') complete(`${prefix}in ${item.alias} `);
      else complete(item.fill);
    },
    [complete, openResult, openPath, prefix]
  );

  /** Tab: fill in the input without acting. */
  const completeItem = useCallback(
    (item: Item) => {
      if (isDisabled(item)) return;
      if (item.type === 'collection')
        complete(`${prefix}${item.mode} ${item.alias}${item.mode === 'in' ? ' ' : ''}`);
      else if (item.type === 'command') complete(item.fill);
    },
    [complete, prefix]
  );

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const item = items[active];
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (items.every(isDisabled)) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // Step over greyed-out rows.
        setActive((from) => {
          let i = from;
          do {
            i = (i + step + items.length) % items.length;
          } while (isDisabled(items[i]));
          return i;
        });
        break;
      }
      case 'Tab': {
        // Tab completes a suggestion; it never moves focus out of the box.
        event.preventDefault();
        if (item) completeItem(item);
        break;
      }
      case 'Enter': {
        if (!item) return;
        event.preventDefault();
        choose(item, event.metaKey || event.ctrlKey);
        break;
      }
      case 'Backspace': {
        // From "/in order " Backspace removes the whole collection chip at once.
        if (scope && inArgs && inArgs.text === '' && /\s$/.test(raw)) {
          event.preventDefault();
          complete(`${prefix}in ${inArgs.token}`);
        }
        break;
      }
    }
  };

  // --- messages ---------------------------------------------------------------
  const skipped = outcome.skipped.length;
  const hasCommands = commandItems.length > 0;
  const showList = items.length > 0;
  const q = scope ? (inArgs?.text ?? '') : parsed.plain;
  const modKey = isMac() ? '⌘' : 'Ctrl';

  let message: { text: string; tone?: 'danger' } | null = null;
  if (collectionsFailed)
    message = { text: 'Could not load collections. Try again.', tone: 'danger' };
  else if (parsed.unknown)
    message = {
      text: `Unknown command ${parsed.unknown === '/' ? '' : '/' + parsed.unknown}. Try in or new.`,
    };
  else if (scopeBlocked && scope)
    message = { text: `You do not have permission to read ${scope.displayName}.` };
  else if (!showList) {
    if (parsed.slash && (inArgs || parsed.newToken !== null) && !scope && collections)
      message = { text: `No collection matches “${inArgs?.token ?? parsed.newToken}”.` };
    else if ((inArgs || parsed.newToken !== null) && !collections)
      message = { text: 'Loading collections…' };
    else if (phase === 'error')
      message = { text: 'Search failed. Check your connection and try again.', tone: 'danger' };
    else if (phase === 'loading') message = { text: 'Searching…' };
    else if (phase === 'done')
      message = {
        text: scope && !q ? `${scope.displayName} has no entries.` : `No entries match “${q}”.`,
      };
    else if (raw.trim() === '')
      message = {
        text: 'Type to search every collection you can read. Try “in” to search inside one or “new” to create.',
      };
  }

  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Content data-strapispot="palette" aria-describedby={undefined}>
        <VisuallyHidden>
          <Modal.Title>Strapispot search</Modal.Title>
        </VisuallyHidden>

        <InputRow alignItems="center">
          <Search width="2rem" height="2rem" aria-hidden />
          <Input
            ref={inputRef}
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={
              scope ? `Search in ${scope.displayName}…` : 'Search entries, or try “in” / “new”'
            }
            role="combobox"
            aria-expanded={showList}
            aria-controls="strapispot-results"
            aria-activedescendant={items[active] ? `strapispot-opt-${active}` : undefined}
            aria-label="Search entries"
            autoComplete="off"
            spellCheck={false}
          />
        </InputRow>

        {scope && (
          <Scope>
            <span>Searching only in</span>
            <Tag>{scope.displayName}</Tag>
            {!q && <span>· showing latest entries</span>}
          </Scope>
        )}

        {showList && (
          <List id="strapispot-results" role="listbox" ref={listRef}>
            {items.map((item, i) => (
              <Fragment key={item.key}>
                {hasCommands && i === 0 && <Heading role="presentation">Commands</Heading>}
                {hasCommands && i === commandItems.length && resultItems.length > 0 && (
                  <Heading role="presentation">Results</Heading>
                )}
                <Row
                  id={`strapispot-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  $active={i === active}
                  $disabled={isDisabled(item)}
                  aria-disabled={isDisabled(item) || undefined}
                  onMouseMove={() => i !== active && !isDisabled(item) && setActive(i)}
                  onClick={(e) => choose(item, e.metaKey || e.ctrlKey)}
                >
                  {item.type === 'result' && (
                    <>
                      <Text>
                        <Typography fontWeight="semiBold" textColor="neutral800" tag="span">
                          <Ellipsis>
                            <Highlight text={item.result.title} query={q} />
                          </Ellipsis>
                        </Typography>
                        {item.result.snippet && (
                          <Typography variant="pi" textColor="neutral600" tag="span">
                            <Ellipsis>
                              <Highlight text={item.result.snippet} query={q} />
                            </Ellipsis>
                          </Typography>
                        )}
                      </Text>
                      <Flex gap={2} style={{ flexShrink: 0 }}>
                        {item.result.status && item.result.status !== 'published' && (
                          <Tag>{item.result.status}</Tag>
                        )}
                        {!scope && <Tag>{item.result.collection}</Tag>}
                      </Flex>
                    </>
                  )}

                  {item.type === 'collection' && (
                    <>
                      <Text>
                        <Typography fontWeight="semiBold" textColor="neutral800" tag="span">
                          <Ellipsis>
                            <Highlight
                              text={item.collection.displayName}
                              query={inArgs?.token ?? ''}
                            />
                          </Ellipsis>
                        </Typography>
                        <Typography variant="pi" textColor="neutral600" tag="span">
                          <Ellipsis>{item.detail}</Ellipsis>
                        </Typography>
                      </Text>
                      {item.disabled ? (
                        <Tag>{item.disabled}</Tag>
                      ) : (
                        i === active && <Kbd>{item.mode === 'new' ? '↵ create' : 'Tab'}</Kbd>
                      )}
                    </>
                  )}

                  {item.type === 'command' && (
                    <>
                      <Text>
                        <Typography fontWeight="semiBold" textColor="neutral800" tag="span">
                          {item.command.keyword}
                        </Typography>
                        <Typography variant="pi" textColor="neutral600" tag="span">
                          {item.command.description}
                        </Typography>
                      </Text>
                      {i === active && <Kbd>Tab</Kbd>}
                    </>
                  )}
                </Row>
              </Fragment>
            ))}
          </List>
        )}

        {message && (
          <Message>
            <Typography textColor={message.tone === 'danger' ? 'danger600' : 'neutral600'}>
              {message.text}
            </Typography>
          </Message>
        )}

        <Footer justifyContent="space-between">
          <span>
            ↑↓ move · {hasCommands ? '⇥ complete' : '↵ open'} · {modKey}↵ new tab · Esc close
          </span>
          <span>
            {phase === 'done' && skipped > 0
              ? `${skipped} collection${skipped > 1 ? 's' : ''} not searched`
              : formatShortcut(shortcut)}
          </span>
        </Footer>
      </Content>
    </Modal.Root>
  );
};

export { Palette };
