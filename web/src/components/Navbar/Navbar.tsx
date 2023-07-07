import type { FC } from 'react';
import { FaRegUserCircle } from 'react-icons/fa';
import { IoExitOutline } from 'react-icons/io5';

import { Button, Flex, Text } from '@chakra-ui/react';

import { useAuth } from '@/hooks';

export const Navbar: FC = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = () => signOut();

  if (!user) return null;

  return (
    <Flex
      w="100%"
      h="45px"
      align="center"
      zIndex="999"
      position="fixed"
      top={0}
      bgColor="rgba(255, 255, 255, 0.15)"
      backdropFilter="blur(6.5px)"
      borderBottom="1px solid #dee2e6"
    >
      <Button variant="ghost" ml={3}>
        <Text
          fontSize="xl"
          fontStyle="italic"
          fontWeight="bold"
          transition="transform 0.2s ease"
          _hover={{
            cursor: 'pointer',
            transform: 'translateY(-2px)'
          }}
        >
          EX3
        </Text>
      </Button>

      <Flex align="center" gap="0.5rem" ml="auto" mr={1.5}>
        <Button variant="ghost" size="sm" gap="0.5rem">
          <FaRegUserCircle size={20} />

          {!!user.name && <Text fontSize="sm">{user.name}</Text>}
        </Button>

        <Button variant="ghost" size="sm" color="red" onClick={handleSignOut}>
          <IoExitOutline size={22} />
        </Button>
      </Flex>
    </Flex>
  );
};
