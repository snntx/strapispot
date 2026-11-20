import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  SingleSelect,
  SingleSelectOption,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from '@strapi/design-system';
import { Layouts, Page, useNotification } from '@strapi/strapi/admin';

import { loadCollections, type CollectionInfo } from '../api/collections';
import {
  DEFAULT_SETTINGS,
  getLocalShortcut,
  loadSettings,
  saveSettings,
  setLocalShortcut,
  clearSettingsCache,
  type Settings,
} from '../api/settings';
import { ShortcutInput } from '../components/ShortcutInput';
import { DEFAULT_SHORTCUT } from '../utils/shortcut';

const PERMISSIONS = [{ action: 'plugin::strapispot.settings.update', subject: null }];
const USE_DEFAULT = '__default__';

const SettingsPage = () => {
  const { toggleNotification } = useNotification();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [localShortcut, setLocal] = useState<string | null>(getLocalShortcut());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    clearSettingsCache();
    Promise.all([loadSettings(controller.signal), loadCollections(controller.signal)])
      .then(([settings, cols]) => {
        setSaved(settings);
        setDraft(settings);
        setCollections(cols);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Could not load the settings. Reload the page to try again.');
      });
    return () => controller.abort();
  }, []);

  const dirty = useMemo(
    () => saved !== null && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  );

  const setSearchable = (uid: string, searchable: boolean) =>
    setDraft((d) => ({
      ...d,
      excluded: searchable
        ? d.excluded.filter((u) => u !== uid)
        : [...new Set([...d.excluded, uid])],
    }));

  const setTitleField = (uid: string, field: string) =>
    setDraft((d) => {
      const titleFields = { ...d.titleFields };
      if (field === USE_DEFAULT) delete titleFields[uid];
      else titleFields[uid] = field;
      return { ...d, titleFields };
    });

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveSettings(draft);
      setSaved(result);
      setDraft(result);
      toggleNotification({ type: 'success', message: 'Strapispot settings saved.' });
    } catch {
      toggleNotification({ type: 'danger', message: 'Could not save the settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page.Protect permissions={PERMISSIONS}>
      <Page.Main>
        <Page.Title>Strapispot</Page.Title>
        <Layouts.Header
          title="Strapispot"
          subtitle="Settings for the search and command palette."
          primaryAction={
            <Button onClick={save} loading={saving} disabled={!dirty || saving}>
              Save
            </Button>
          }
        />
        <Layouts.Content>
          {error && (
            <Box paddingBottom={4}>
              <Typography textColor="danger600">{error}</Typography>
            </Box>
          )}

          <Flex direction="column" alignItems="stretch" gap={6}>
            <Box background="neutral0" hasRadius shadow="filterShadow" padding={6}>
              <Flex direction="column" alignItems="stretch" gap={5}>
                <Typography variant="delta" tag="h2">
                  Shortcut
                </Typography>

                <Flex direction="column" alignItems="flex-start" gap={2}>
                  <Typography fontWeight="semiBold">Default for everyone</Typography>
                  <ShortcutInput
                    label="Default shortcut"
                    value={draft.shortcut}
                    onChange={(shortcut) => setDraft((d) => ({ ...d, shortcut }))}
                    onReset={() => setDraft((d) => ({ ...d, shortcut: DEFAULT_SHORTCUT }))}
                    resetLabel="Reset to default"
                  />
                  <Typography variant="pi" textColor="neutral600">
                    Click the box and press the keys. It needs Cmd/Ctrl or Alt. Saved for the whole
                    project.
                  </Typography>
                </Flex>

                <Flex direction="column" alignItems="flex-start" gap={2}>
                  <Typography fontWeight="semiBold">Only in this browser</Typography>
                  <ShortcutInput
                    label="Shortcut for this browser"
                    value={localShortcut}
                    placeholder="Use the default"
                    onChange={(value) => {
                      setLocalShortcut(value);
                      setLocal(value);
                    }}
                    onReset={() => {
                      setLocalShortcut(null);
                      setLocal(null);
                    }}
                    resetLabel="Use the default"
                  />
                  <Typography variant="pi" textColor="neutral600">
                    Overrides the default for you, on this browser only, and applies at once. Handy
                    when a browser keeps a key for itself: Ctrl+Shift+K opens the developer console
                    in Firefox.
                  </Typography>
                </Flex>
              </Flex>
            </Box>

            <Box background="neutral0" hasRadius shadow="filterShadow" padding={6}>
              <Flex direction="column" alignItems="stretch" gap={4}>
                <Flex direction="column" alignItems="flex-start" gap={1}>
                  <Typography variant="delta" tag="h2">
                    Collections
                  </Typography>
                  <Typography variant="pi" textColor="neutral600">
                    Choose which collections the palette searches, and which field is shown as each
                    entry's title.
                  </Typography>
                </Flex>

                <Table colCount={3} rowCount={collections.length + 1}>
                  <Thead>
                    <Tr>
                      <Th>
                        <Typography variant="sigma">Collection</Typography>
                      </Th>
                      <Th>
                        <Typography variant="sigma">Searchable</Typography>
                      </Th>
                      <Th>
                        <Typography variant="sigma">Title field</Typography>
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {collections.map((c) => (
                      <Tr key={c.uid}>
                        <Td>
                          <Typography fontWeight="semiBold">{c.displayName}</Typography>
                        </Td>
                        <Td>
                          <Checkbox
                            aria-label={`Search in ${c.displayName}`}
                            checked={!draft.excluded.includes(c.uid)}
                            onCheckedChange={(checked: boolean | 'indeterminate') =>
                              setSearchable(c.uid, checked === true)
                            }
                          />
                        </Td>
                        <Td>
                          <SingleSelect
                            aria-label={`Title field for ${c.displayName}`}
                            size="S"
                            value={
                              draft.titleFields[c.uid] &&
                              c.titleFields.includes(draft.titleFields[c.uid])
                                ? draft.titleFields[c.uid]
                                : USE_DEFAULT
                            }
                            onChange={(value: string | number) =>
                              setTitleField(c.uid, String(value))
                            }
                          >
                            <SingleSelectOption value={USE_DEFAULT}>
                              {`Default (${c.defaultMainField})`}
                            </SingleSelectOption>
                            {c.titleFields
                              .filter((f) => f !== c.defaultMainField)
                              .map((f) => (
                                <SingleSelectOption key={f} value={f}>
                                  {f}
                                </SingleSelectOption>
                              ))}
                          </SingleSelect>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Flex>
            </Box>
          </Flex>
        </Layouts.Content>
      </Page.Main>
    </Page.Protect>
  );
};

export default SettingsPage;
