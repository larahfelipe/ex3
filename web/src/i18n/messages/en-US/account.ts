import type { LocaleMessages, Messages } from '../catalog';

export default {
  description: 'Your profile, security details and preferences',
  loadFailed: "Couldn't load your account details",
  loading: 'Loading your account details',
  profile: {
    title: 'Profile',
    description: 'Your name and the email you sign in with',
    email: 'Email',
    saved: 'Profile updated'
  },
  security: {
    title: 'Security',
    description: 'The password you sign in with',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmNewPassword: 'Confirm new password',
    signOutNote:
      'Changing your password signs you out on every device, including this one.',
    submit: 'Change password',
    changed: 'Password changed. Sign in with your new password.'
  },
  preferences: {
    title: 'Preferences',
    description:
      'The interface language, which also writes dates, numbers and amounts',
    languageHint: 'Applies right away and is saved on this browser.'
  }
} as const satisfies LocaleMessages<Messages['account']>;
