import React from 'react';
import { Linking } from 'react-native';
import { NextStep } from '../domain/guidance';
import { Button, Card, H2, P } from './components';

export function StepCard({ step }: { step: NextStep }) {
  const tone = step.level === 'urgent' ? 'danger' : step.level === 'safety' || step.level === 'evaluate' ? 'warn' : 'default';
  return (
    <Card tone={tone}>
      <H2>{step.title}</H2>
      <P>{step.body}</P>
      {step.level === 'urgent' ? <Button title="Ligar 192 (SAMU)" kind="danger" onPress={() => Linking.openURL('tel:192')} /> : null}
    </Card>
  );
}
