'use client';

import { forwardRef, useState, type ComponentRef, type FC } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

import {
  Box as ChakraBox,
  Button as ChakraButton,
  Input as ChakraInput,
  InputGroup as ChakraInputGroup,
  InputLeftElement as ChakraInputLeftElement,
  InputRightElement as ChakraInputRightElement,
  Text as ChakraText
} from '@chakra-ui/react';

import type { InputProps } from './Input.types';

export const Input: FC<InputProps> = forwardRef<
  ComponentRef<typeof ChakraInput>,
  InputProps
>(({ type, withLeftElement, withRightElement, error, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const handleChangePasswordVisibility = () => setShowPassword((curr) => !curr);

  return (
    <ChakraBox>
      <ChakraInputGroup>
        {withLeftElement && (
          <ChakraInputLeftElement pointerEvents="none">
            {withLeftElement}
          </ChakraInputLeftElement>
        )}

        <ChakraInput
          ref={ref}
          type={type === 'password' && showPassword ? 'text' : type}
          {...props}
        />

        {withRightElement && (
          <ChakraInputRightElement pointerEvents="none">
            {withRightElement}
          </ChakraInputRightElement>
        )}

        {type === 'password' && !withRightElement && (
          <ChakraInputRightElement mr="1">
            <ChakraButton
              variant="ghost"
              size="sm"
              onClick={handleChangePasswordVisibility}
            >
              {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
            </ChakraButton>
          </ChakraInputRightElement>
        )}
      </ChakraInputGroup>

      {!!error && (
        <ChakraText fontSize="sm" color="red.500" mt="1.5">
          {error}
        </ChakraText>
      )}
    </ChakraBox>
  );
});

Input.displayName = 'Input';
