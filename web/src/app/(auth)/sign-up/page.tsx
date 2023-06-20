'use client';

import { useForm } from 'react-hook-form';
import { FiUser } from 'react-icons/fi';
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

import { SignUpSchema } from './SignUp.schema';
import type { SignUpFormData } from './SignUp.types';
import { useSignUp } from './useSignUp';

const SignIn: NextPage = () => {
  const { user, signUpHandler, isLoading } = useSignUp();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<SignUpFormData>({
    resolver: zodResolver(SignUpSchema),
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
            EX3 – Sign up
          </Text>
        </CardHeader>

        <Divider color="blackAlpha.300" />

        <CardBody>
          <form id="signup-form" onSubmit={handleSubmit(signUpHandler)}>
            <Stack spacing="4">
              <Input
                placeholder="Name"
                withLeftElement={<FiUser size={18} color="gray" />}
                isInvalid={!!errors.name}
                error={errors.name?.message as string}
                {...register('name')}
              />

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

              <Input
                type="password"
                placeholder="Confirm password"
                withLeftElement={<VscKey size={18} color="gray" />}
                isInvalid={!!errors.confirmPassword}
                error={errors.confirmPassword?.message as string}
                {...register('confirmPassword')}
              />
            </Stack>
          </form>
        </CardBody>

        <CardFooter>
          <Stack w="full">
            <Button
              type="submit"
              form="signup-form"
              width="full"
              isLoading={isLoading}
              disabled={!isValid || isLoading}
            >
              Sign up
            </Button>

            <Box position="relative" p="5">
              <Divider color="blackAlpha.300" />

              <AbsoluteCenter bg="white" px="3">
                <Text color="blackAlpha.500">already registered?</Text>
              </AbsoluteCenter>
            </Box>

            <Button
              variant="ghost"
              width="full"
              as={Link}
              href="/sign-in"
              disabled={isLoading}
            >
              Sign in instead
            </Button>
          </Stack>
        </CardFooter>
      </Card>
    </Flex>
  );
};

export default SignIn;
