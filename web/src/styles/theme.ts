import { extendTheme } from '@chakra-ui/react';

export const theme = extendTheme({
  styles: {
    global: {
      '*': {
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        WebkitFontSmoothing: 'antialiased',
        WebkitAppearance: 'none'
      },
      body: {
        fontSize: '88.5%',
        fontFamily: 'Archivo, sans-serif',
        fontWeight: 500,
        backgroundColor: 'blackAlpha.100',
        color: 'blackAlpha.900'
      }
    }
  }
});
