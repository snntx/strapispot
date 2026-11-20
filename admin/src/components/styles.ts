import { Flex, Modal } from '@strapi/design-system';
import styled from 'styled-components';

export const Content = styled(Modal.Content)`
  max-width: 640px;
  width: calc(100vw - 2.4rem);
  top: 12vh;
  transform: translate(-50%, 0);
  padding: 0;
  overflow: hidden;
`;

export const InputRow = styled(Flex)`
  padding: 1.2rem 1.6rem;
  gap: 1.2rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
`;

export const Input = styled.input`
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.neutral800};
  font-size: 1.6rem;
  line-height: 2.4rem;
  &::placeholder {
    color: ${({ theme }) => theme.colors.neutral500};
  }
`;

export const Scope = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 1.6rem;
  font-size: 1.2rem;
  color: ${({ theme }) => theme.colors.neutral600};
  border-bottom: 1px solid ${({ theme }) => theme.colors.neutral150};
`;

export const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0.8rem;
  max-height: min(55vh, 42rem);
  overflow-y: auto;
`;

export const Row = styled.li<{ $active: boolean; $disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  padding: 0.8rem 1.2rem;
  border-radius: ${({ theme }) => theme.borderRadius};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
  background: ${({ $active, theme }) => ($active ? theme.colors.primary100 : 'transparent')};
  outline: ${({ $active, theme }) => ($active ? `1px solid ${theme.colors.primary200}` : 'none')};
`;

export const Text = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

export const Ellipsis = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Tag = styled.span`
  flex-shrink: 0;
  font-size: 1.1rem;
  line-height: 1.6rem;
  padding: 0 0.8rem;
  border-radius: 1rem;
  color: ${({ theme }) => theme.colors.neutral700};
  background: ${({ theme }) => theme.colors.neutral150};
`;

export const Kbd = styled.kbd`
  font-family: inherit;
  font-size: 1.1rem;
  line-height: 1.6rem;
  padding: 0 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  color: ${({ theme }) => theme.colors.neutral600};
`;

export const Footer = styled(Flex)`
  padding: 0.8rem 1.6rem;
  gap: 1.6rem;
  border-top: 1px solid ${({ theme }) => theme.colors.neutral150};
  color: ${({ theme }) => theme.colors.neutral600};
  font-size: 1.2rem;
`;

export const Message = styled.div`
  padding: 2.4rem 1.6rem;
  text-align: center;
`;

export const Heading = styled.li`
  list-style: none;
  padding: 0.6rem 1.2rem 0.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.neutral500};
`;
