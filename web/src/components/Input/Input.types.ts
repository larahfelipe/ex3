import type { InputProps as ChakraInputProps } from '@chakra-ui/react';

export type InputProps = ChakraInputProps & {
  withLeftElement?: JSX.Element;
  withRightElement?: JSX.Element;
  error?: string;
};
