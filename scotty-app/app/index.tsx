import React from 'react';
import { Redirect } from 'expo-router';
import { DEV_SKIP_ONBOARDING } from '@/constants/DevConfig';

export default function Index() {
  if (DEV_SKIP_ONBOARDING) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/(onboarding)/adoption" />;
}
