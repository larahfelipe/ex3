'use client';

import { useCallback, useState } from 'react';

export const useDisclosure = (
  initialState = false,
  cb?: { onOpen?: () => void; onClose?: () => void }
) => {
  const { onOpen, onClose } = cb || {};
  const [opened, setOpened] = useState(initialState);

  const open = useCallback(() => {
    setOpened((isOpened) => {
      if (!isOpened) {
        if (onOpen && typeof onOpen === 'function') onOpen();
        return true;
      }
      return isOpened;
    });
  }, [onOpen]);

  const close = useCallback(() => {
    setOpened((isOpened) => {
      if (isOpened) {
        if (onClose && typeof onClose === 'function') onClose();
        return false;
      }
      return isOpened;
    });
  }, [onClose]);

  const toggle = useCallback(() => {
    opened ? close() : open();
  }, [close, open, opened]);

  return [opened, { open, close, toggle }] as const;
};
