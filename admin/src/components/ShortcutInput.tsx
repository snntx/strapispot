import { useState } from 'react';
import { Button, Flex, Typography } from '@strapi/design-system';
import styled from 'styled-components';

import { captureShortcut, formatShortcut, parseShortcut } from '../utils/shortcut';

const Box = styled.button<{ $recording: boolean }>`
  min-width: 18rem;
  height: 4rem;
  padding: 0 1.6rem;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.neutral800};
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid
    ${({ $recording, theme }) => ($recording ? theme.colors.primary600 : theme.colors.neutral200)};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ $recording, theme }) => ($recording ? `0 0 0 2px ${theme.colors.primary200}` : 'none')};
`;

type Props = {
  /** Shortcut string such as "Mod+Shift+K", or null when nothing is set. */
  value: string | null;
  onChange: (value: string) => void;
  /** When given, a button next to the field calls this (e.g. "Use the default"). */
  onReset?: () => void;
  resetLabel?: string;
  placeholder?: string;
  label: string;
};

/** Click the box, then press the key combination you want. Esc cancels. */
export const ShortcutInput = ({
  value,
  onChange,
  onReset,
  resetLabel,
  placeholder,
  label,
}: Props) => {
  const [recording, setRecording] = useState(false);
  const parsed = value ? parseShortcut(value) : null;

  return (
    <Flex gap={3} alignItems="center" wrap="wrap">
      <Box
        type="button"
        $recording={recording}
        aria-label={label}
        onClick={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(event) => {
          if (!recording) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key === 'Escape') {
            setRecording(false);
            return;
          }
          const captured = captureShortcut(event.nativeEvent);
          if (captured) {
            onChange(captured);
            setRecording(false);
          }
        }}
      >
        {recording ? (
          <Typography textColor="primary600">Press the new shortcut…</Typography>
        ) : parsed ? (
          <Typography fontWeight="semiBold">{formatShortcut(parsed)}</Typography>
        ) : (
          <Typography textColor="neutral500">{placeholder ?? 'Not set'}</Typography>
        )}
      </Box>
      {onReset && (
        <Button variant="tertiary" size="S" onClick={onReset} disabled={!value}>
          {resetLabel ?? 'Reset'}
        </Button>
      )}
    </Flex>
  );
};
