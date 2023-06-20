'use client';

import { useForm } from 'react-hook-form';
import { MdAlternateEmail } from 'react-icons/md';
import { VscKey } from 'react-icons/vsc';

import type { NextPage } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  AbsoluteCenter,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  Flex,
  Stack,
  Text
} from '@chakra-ui/react';
import { zodResolver } from '@hookform/resolvers/zod';

import { Input } from '@/components';

import { SignInSchema } from './SignIn.schema';
import type { SignInFormData } from './SignIn.types';
import { useSignIn } from './useSignIn';

const SignIn: NextPage = () => {
  const { user, signInHandler, isLoading } = useSignIn();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignInFormData>({
    resolver: zodResolver(SignInSchema),
    mode: 'onBlur'
  });

  if (user?.id) redirect('/dashboard');

  return (
    <Flex
      h="100vh"
      justify="center"
      align="center"
      bgImage="url('/gradient-bg.jpg')"
      bgSize="cover"
    >
      <Card variant="outline" w="sm">
        <CardHeader>
          <Text fontWeight="bold" color="blackAlpha.800" textAlign="center">
            EX3 – Sign in
          </Text>
        </CardHeader>

        <Divider color="blackAlpha.300" />

        <CardBody>
          <form id="signin-form" onSubmit={handleSubmit(signInHandler)}>
            <Stack spacing="4">
              <Input
                placeholder="E-mail"
                withLeftElement={<MdAlternateEmail size={18} color="gray" />}
                isInvalid={!!errors.email}
                error={errors.email?.message as string}
                {...register('email')}
              />

              <Input
                type="password"
                placeholder="Password"
                withLeftElement={<VscKey size={18} color="gray" />}
                isInvalid={!!errors.password}
                error={errors.password?.message as string}
                {...register('password')}
              />
            </Stack>
          </form>
        </CardBody>

        <CardFooter>
          <Stack w="full">
            <Button
              type="submit"
              form="signin-form"
              width="full"
              isLoading={isLoading}
              disabled={!isValid || isLoading}
            >
              Sign in
            </Button>

            <Box position="relative" p="5">
              <Divider color="blackAlpha.300" />

              <AbsoluteCenter bg="white" px="3">
                <Text color="blackAlpha.500">or</Text>
              </AbsoluteCenter>
            </Box>

            <Button
              variant="outline"
              width="full"
              as={Link}
              href="/sign-up"
              disabled={isLoading}
            >
              Sign up
            </Button>
          </Stack>
        </CardFooter>
      </Card>
    </Flex>
  );
};

export default SignIn;
