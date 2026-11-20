import styled from 'styled-components';

import { highlightSegments } from '../utils/highlight';

const Mark = styled.mark`
  background: ${({ theme }) => theme.colors.warning200};
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
  font-weight: 700;
`;

/** Renders `text` with the parts that match `query` highlighted. */
export const Highlight = ({ text, query }: { text: string; query: string }) => (
  <>
    {highlightSegments(text, query).map((seg, i) =>
      seg.match ? <Mark key={i}>{seg.text}</Mark> : <span key={i}>{seg.text}</span>
    )}
  </>
);
